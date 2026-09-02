import { NodePath, types as t } from '@babel/core';
import { HubFile, Optimizer } from '../../types';
import PluginError from '../../utils/plugin-error';
import { BailoutCheck, getFirstBailoutReason } from '../../utils/helpers';
import {
  addFileImportHint,
  buildPropertiesFromAttributes,
  hasBlacklistedProperty,
  hasBlacklistedPropertyInSpread,
  isIgnoredLine,
  isForcedLine,
  isReactNativeComponent,
  isStaticLiteralTree,
  makeAttribute,
  replaceWithNativeComponent,
  ancestorBailoutChecks,
  createStyleOriginResolver,
} from '../../utils/common';
import { RUNTIME_MODULE_NAME } from '../../utils/constants';

const IMAGE_BAILOUT_PROPS = new Set([
  'aria-live',
  'aria-valuemax',
  'aria-valuemin',
  'aria-valuenow',
  'aria-valuetext',
  'children',
  'defaultSource',
  'id',
  'internal_analyticTag',
  'loadingIndicatorSource',
  'onError',
  'onLoad',
  'onLoadEnd',
  'onLoadStart',
  'onPartialLoad',
  'onProgress',
  'ref',
  'srcSet',
  'tabIndex',
]);

const IMAGE_ARIA_STATE_PROPS = new Set([
  'aria-busy',
  'aria-checked',
  'aria-disabled',
  'aria-expanded',
  'aria-selected',
]);

const IMAGE_REQUEST_HEADER_PROPS = new Set(['crossOrigin', 'referrerPolicy']);

const IMAGE_SPREAD_GUARD_PROPS = new Set([
  ...IMAGE_BAILOUT_PROPS,
  ...IMAGE_REQUEST_HEADER_PROPS,
  ...IMAGE_ARIA_STATE_PROPS,
  'accessible',
  'accessibilityLabel',
  'accessibilityLabelledBy',
  'accessibilityState',
  'alt',
  'aria-hidden',
  'aria-label',
  'aria-labelledby',
  'height',
  'importantForAccessibility',
  'resizeMode',
  'source',
  'src',
  'style',
  'tintColor',
  'width',
]);

const IMAGE_BASE_STYLE = t.objectExpression([t.objectProperty(t.identifier('overflow'), t.stringLiteral('hidden'))]);

const OBJECT_FIT_TO_RESIZE_MODE: Record<string, string> = {
  'contain': 'contain',
  'cover': 'cover',
  'fill': 'stretch',
  'none': 'none',
  'scale-down': 'contain',
};

export const imageOptimizer: Optimizer = (path, logger, options, platform, unistylesEnabled) => {
  if (platform === 'web') return;
  if (!isReactNativeComponent(path, 'Image')) return;

  const parent = path.parent as t.JSXElement;
  const forced = isForcedLine(path);

  // In Unistyles mode, classify the direct `style` origin (lazily, once). A `style` carried by a
  // resolvable spread already bails (`style` is in {@link IMAGE_SPREAD_GUARD_PROPS}), as does an
  // unresolvable spread. See {@link classifyStyleOrigin}.
  const getStyleOrigin = createStyleOriginResolver(path, unistylesEnabled);

  const hardChecks: BailoutCheck[] = [
    {
      reason: 'target platform is unknown',
      shouldBail: () => platform !== 'ios' && platform !== 'android',
    },
    {
      // Unlike Text/View, a provably Unistyles-styled Image cannot be routed: Unistyles ships no lean
      // Image host, so optimizing it would drop the shadow-tree registration and freeze theme updates.
      reason: 'has a Unistyles style and there is no lean Image host to route to',
      shouldBail: () => getStyleOrigin() === 'unistyles',
    },
    {
      reason: 'contains unsupported Image props',
      shouldBail: () => hasBlacklistedProperty(path, IMAGE_BAILOUT_PROPS),
    },
    {
      reason: 'has a spread that may carry Image wrapper props',
      shouldBail: () => hasBlacklistedPropertyInSpread(path, IMAGE_SPREAD_GUARD_PROPS),
    },
    {
      reason: 'contains non-empty children',
      shouldBail: () => parent.children.some((child) => !t.isJSXText(child) || child.value.trim() !== ''),
    },
    {
      reason: 'has an unsupported or dynamic source',
      shouldBail: () => !hasImageSourceInput(path.node.attributes),
    },
  ];

  const overridableChecks: BailoutCheck[] = [
    {
      reason: 'has an unresolved style source that may be a Unistyles style',
      shouldBail: () => getStyleOrigin() === 'unknown',
    },
    ...ancestorBailoutChecks(path, options?.dangerouslyOptimizeImageWithUnknownAncestors === true),
  ];

  const hardSkipReason = getFirstBailoutReason(hardChecks);
  if (hardSkipReason) {
    logger.skipped({ component: 'Image', path, reason: hardSkipReason });
    return;
  }

  if (forced) {
    const overriddenReason = getFirstBailoutReason(overridableChecks);
    if (overriddenReason) {
      logger.forced({ component: 'Image', path, reason: overriddenReason });
    }
  } else {
    const skipReason = getFirstBailoutReason([
      {
        reason: 'line is marked with @boost-ignore',
        shouldBail: () => isIgnoredLine(path),
      },
      ...overridableChecks,
    ]);

    if (skipReason) {
      logger.skipped({ component: 'Image', path, reason: skipReason });
      return;
    }
  }

  const hub = path.hub as unknown;
  const file = typeof hub === 'object' && hub !== null && 'file' in hub ? (hub.file as HubFile) : undefined;

  if (!file) {
    throw new PluginError('No file found in Babel hub');
  }

  const nativeSource = buildStaticNativeSource(path.node.attributes, platform);
  const styleInfo = buildStaticStyleInfo(path.node.attributes);

  logger.optimized({ component: 'Image', path });

  if (nativeSource && styleInfo !== null) {
    processImageProps(path, file, nativeSource, styleInfo, platform);
  } else {
    processRuntimeImageProps(path, file, platform);
  }
  replaceWithNativeComponent(path, parent, file, 'NativeImage');
};

type NativeSource = {
  sourceAttributes: t.JSXAttribute[];
  requestHeaderAttributes: t.JSXAttribute[];
  sourceArray: t.ArrayExpression;
  consumesSizeProps: boolean;
  androidHeaders?: t.Expression;
  width?: t.Expression;
  height?: t.Expression;
  /**
   * `width`/`height` came from an ARRAY source's single entry, which only the wrapper of some RN
   * versions propagates into the layout style — so they are emitted through the runtime gate
   * `processImageArraySourceDimensions` instead of inline.
   */
  arraySourceDimensions?: boolean;
  /**
   * `androidHeaders` came from a plain OBJECT source's inline `headers`, which only the wrapper of
   * some RN versions lifts to the top-level prop — so they are emitted through the runtime gate
   * `processImageObjectSourceHeaders` instead of inline.
   */
  objectSourceHeaders?: boolean;
};

type StyleInfo = {
  styleAttribute?: t.JSXAttribute;
  styleExpression?: t.Expression;
  objectFitResizeMode?: t.Expression;
  styleResizeMode?: t.Expression;
  tintColor?: t.Expression;
} | null;

type ImageAccessibilityInfo = {
  attributes: t.JSXAttribute[];
  spreadAttribute: t.JSXSpreadAttribute;
};

type RuntimeImageInfo = {
  attributes: t.JSXAttribute[];
  spreadAttribute: t.JSXSpreadAttribute;
};

function processImageProps(
  path: NodePath<t.JSXOpeningElement>,
  file: HubFile,
  nativeSource: NativeSource,
  styleInfo: StyleInfo,
  platform?: string
) {
  const accessibilityInfo = buildImageAccessibilityInfo(path, file, platform);
  const consumed = new Set<t.JSXAttribute>([
    ...nativeSource.sourceAttributes,
    ...nativeSource.requestHeaderAttributes,
    ...(accessibilityInfo?.attributes ?? []),
  ]);
  if (styleInfo?.styleAttribute) consumed.add(styleInfo.styleAttribute);

  const remaining = path.node.attributes.filter((attribute) => {
    if (!t.isJSXAttribute(attribute)) return true;
    if (consumed.has(attribute)) return false;
    const name = attribute.name.name;
    if (nativeSource.consumesSizeProps && (name === 'width' || name === 'height')) return false;
    return name !== 'resizeMode' && name !== 'tintColor';
  });

  const explicitResizeMode = getAttributeExpression(path.node.attributes, 'resizeMode');
  const explicitTintColor = getAttributeExpression(path.node.attributes, 'tintColor');
  const tintColor = buildTintColor(explicitTintColor, styleInfo?.tintColor, platform);
  const emitsAndroidProps = platform === 'android';

  // Both gates are Android-only and are wired up only when there is something to gate, so an Image
  // that hits neither case keeps a fully static prop bag.
  const gatesArrayDimensions =
    emitsAndroidProps &&
    nativeSource.arraySourceDimensions === true &&
    (nativeSource.width !== undefined || nativeSource.height !== undefined);
  const arrayDimensionsGate = gatesArrayDimensions
    ? addRuntimeHelper(path, file, 'processImageArraySourceDimensions')
    : undefined;

  const androidHeaders =
    emitsAndroidProps && nativeSource.androidHeaders
      ? nativeSource.objectSourceHeaders
        ? t.callExpression(addRuntimeHelper(path, file, 'processImageObjectSourceHeaders'), [
            t.cloneNode(nativeSource.androidHeaders, true),
          ])
        : t.cloneNode(nativeSource.androidHeaders, true)
      : undefined;

  path.node.attributes = [
    ...remaining,
    accessibilityInfo?.spreadAttribute,
    makeAttribute('style', buildStyle(nativeSource, styleInfo, arrayDimensionsGate)),
    makeAttribute('source', nativeSource.sourceArray),
    androidHeaders ? makeAttribute('headers', androidHeaders) : undefined,
    makeAttribute('resizeMode', buildResizeMode(explicitResizeMode, styleInfo)),
    tintColor ? makeAttribute('tintColor', tintColor) : undefined,
  ].filter((attribute): attribute is t.JSXAttribute | t.JSXSpreadAttribute => attribute !== undefined);
}

function addRuntimeHelper(path: NodePath<t.JSXOpeningElement>, file: HubFile, importName: string): t.Identifier {
  return t.identifier(
    addFileImportHint({ file, nameHint: importName, path, importName, moduleName: RUNTIME_MODULE_NAME }).name
  );
}

function processRuntimeImageProps(path: NodePath<t.JSXOpeningElement>, file: HubFile, platform?: string) {
  const accessibilityInfo = buildImageAccessibilityInfo(path, file, platform);
  const runtimeInfo = buildRuntimeImageInfo(path, file);
  if (!runtimeInfo) return;

  const consumed = new Set<t.JSXAttribute>([...runtimeInfo.attributes, ...(accessibilityInfo?.attributes ?? [])]);

  const remaining = path.node.attributes.filter(
    (attribute) => !t.isJSXAttribute(attribute) || !consumed.has(attribute)
  );

  path.node.attributes = [...remaining, accessibilityInfo?.spreadAttribute, runtimeInfo.spreadAttribute].filter(
    (attribute): attribute is t.JSXAttribute | t.JSXSpreadAttribute => attribute !== undefined
  );
}

function buildImageAccessibilityInfo(
  path: NodePath<t.JSXOpeningElement>,
  file: HubFile,
  platform?: string
): ImageAccessibilityInfo | undefined {
  const directNames = getDirectAttributeNames(path.node.attributes);
  const hasAlt = directNames.has('alt');
  const hasLabelTrigger = hasAlt || directNames.has('aria-label');
  const hasHiddenTrigger = directNames.has('aria-hidden');
  const hasLabelledByTrigger = directNames.has('aria-labelledby');
  const hasStateTrigger = [...IMAGE_ARIA_STATE_PROPS].some((name) => directNames.has(name));
  // Android drops a nullish `accessible`, so passing the authored value through would emit an
  // `accessible={null}` the wrapper never sets. iOS forwards it unchanged, so only Android needs the helper.
  const accessible = getAttributeExpression(path.node.attributes, 'accessible');
  const hasNullableAccessible =
    platform === 'android' && accessible !== undefined && !isStaticNonNullishExpression(accessible);

  if (!hasLabelTrigger && !hasHiddenTrigger && !hasLabelledByTrigger && !hasStateTrigger && !hasNullableAccessible) {
    return undefined;
  }

  const helperNames = new Set<string>();
  if (hasLabelTrigger) {
    helperNames.add('alt');
    helperNames.add('aria-label');
    helperNames.add('accessibilityLabel');
  }
  if (hasAlt || hasNullableAccessible) {
    helperNames.add('accessible');
  }
  if (hasHiddenTrigger) {
    helperNames.add('aria-hidden');
    helperNames.add('accessible');
    helperNames.add('alt');
    helperNames.add('importantForAccessibility');
  }
  if (hasLabelledByTrigger) {
    helperNames.add('aria-labelledby');
    helperNames.add('accessibilityLabelledBy');
  }
  if (hasStateTrigger) {
    helperNames.add('accessibilityState');
    for (const name of IMAGE_ARIA_STATE_PROPS) helperNames.add(name);
  }

  const attributes = path.node.attributes.filter(
    (attribute): attribute is t.JSXAttribute =>
      t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name) && helperNames.has(attribute.name.name)
  );

  if (attributes.length === 0) return undefined;

  const helperIdentifier = addFileImportHint({
    file,
    nameHint: 'processImageAccessibilityProps',
    path,
    importName: 'processImageAccessibilityProps',
    moduleName: RUNTIME_MODULE_NAME,
  });

  return {
    attributes,
    spreadAttribute: t.jsxSpreadAttribute(
      t.callExpression(t.identifier(helperIdentifier.name), [buildPropertiesFromAttributes(attributes)])
    ),
  };
}

function buildRuntimeImageInfo(path: NodePath<t.JSXOpeningElement>, file: HubFile): RuntimeImageInfo | undefined {
  const attributes = [
    findAttribute(path.node.attributes, 'source'),
    findAttribute(path.node.attributes, 'src'),
    findAttribute(path.node.attributes, 'width'),
    findAttribute(path.node.attributes, 'height'),
    findAttribute(path.node.attributes, 'crossOrigin'),
    findAttribute(path.node.attributes, 'referrerPolicy'),
    findAttribute(path.node.attributes, 'style'),
    findAttribute(path.node.attributes, 'resizeMode'),
    findAttribute(path.node.attributes, 'tintColor'),
  ].filter((attribute): attribute is t.JSXAttribute => attribute !== undefined);

  if (attributes.length === 0) return undefined;

  const helperIdentifier = addFileImportHint({
    file,
    nameHint: 'processImageSourceProps',
    path,
    importName: 'processImageSourceProps',
    moduleName: RUNTIME_MODULE_NAME,
  });

  return {
    attributes,
    spreadAttribute: t.jsxSpreadAttribute(
      t.callExpression(t.identifier(helperIdentifier.name), [buildPropertiesFromAttributes(attributes)])
    ),
  };
}

function buildStaticNativeSource(
  attributes: Array<t.JSXAttribute | t.JSXSpreadAttribute>,
  platform?: string
): NativeSource | undefined {
  const requestHeaders = buildRequestHeaders(attributes);
  if (!requestHeaders) return undefined;

  // Two Android-only wrapper behaviors vary across the supported RN range: propagating a single-entry
  // ARRAY source's intrinsic dimensions into the layout style, and lifting a plain OBJECT source's
  // inline headers to the top-level `headers` prop. iOS does neither on any version. Both are emitted
  // through runtime gates (see the `arraySourceDimensions` / `objectSourceHeaders` flags) so the
  // build-time output tracks the installed RN exactly instead of picking one version's semantics.
  const emitsAndroidProps = platform === 'android';

  const src = findAttribute(attributes, 'src');
  if (src) {
    const uri = getAttributeValueExpression(src);
    if (!t.isStringLiteral(uri)) return undefined;
    const source = findAttribute(attributes, 'source');
    const width = getAttributeExpression(attributes, 'width');
    const height = getAttributeExpression(attributes, 'height');
    // On Android the dimensions are emitted twice (source entry AND style), so a non-literal
    // expression would be evaluated twice; defer those to the runtime helper instead.
    if (emitsAndroidProps) {
      if (width && !isStaticLiteralTree(width)) return undefined;
      if (height && !isStaticLiteralTree(height)) return undefined;
    }
    const headers = t.cloneNode(requestHeaders.headers, true);
    return {
      sourceAttributes: [src, source].filter((attribute): attribute is t.JSXAttribute => attribute !== undefined),
      requestHeaderAttributes: requestHeaders.attributes,
      sourceArray: t.arrayExpression([
        t.objectExpression([
          t.objectProperty(t.identifier('uri'), uri),
          t.objectProperty(t.identifier('headers'), headers),
          ...(width ? [t.objectProperty(t.identifier('width'), width)] : []),
          ...(height ? [t.objectProperty(t.identifier('height'), height)] : []),
        ]),
      ]),
      consumesSizeProps: true,
      androidHeaders: t.cloneNode(requestHeaders.headers, true),
      width: emitsAndroidProps && width ? t.cloneNode(width, true) : undefined,
      height: emitsAndroidProps && height ? t.cloneNode(height, true) : undefined,
      arraySourceDimensions: true,
    };
  }

  const source = findAttribute(attributes, 'source');
  if (!source || !t.isJSXExpressionContainer(source.value)) return undefined;
  const sourceExpression = source.value.expression;
  if (!t.isObjectExpression(sourceExpression) && !t.isArrayExpression(sourceExpression)) return undefined;
  if (!isStaticLiteralTree(sourceExpression)) return undefined;

  if (t.isArrayExpression(sourceExpression)) {
    if (requestHeaders.attributes.length > 0) return undefined;
    const singleEntry = sourceExpression.elements.length === 1 ? sourceExpression.elements[0] : undefined;
    const dimensionSource = emitsAndroidProps && t.isObjectExpression(singleEntry) ? singleEntry : undefined;
    return {
      sourceAttributes: [source],
      requestHeaderAttributes: requestHeaders.attributes,
      sourceArray: t.cloneNode(sourceExpression, true),
      consumesSizeProps: false,
      androidHeaders: getFirstSourceHeaders(sourceExpression),
      width: dimensionSource ? getObjectPropertyExpression(dimensionSource, 'width') : undefined,
      height: dimensionSource ? getObjectPropertyExpression(dimensionSource, 'height') : undefined,
      arraySourceDimensions: true,
    };
  }

  const sourceObject = sourceExpression;
  const sourceWidth = getObjectPropertyExpression(sourceObject, 'width');
  const sourceHeight = getObjectPropertyExpression(sourceObject, 'height');
  const width = getNullishFallback(sourceWidth, getAttributeExpression(attributes, 'width'));
  const height = getNullishFallback(sourceHeight, getAttributeExpression(attributes, 'height'));
  const sourceArrayObject = buildSourceObject(sourceObject, requestHeaders);
  // An object source with generated request headers and a truthy `uri` goes through ImageSourceUtils
  // as a single-entry ARRAY source, so the width/height ?? prop fallback does not apply: only the
  // source entry's own dimensions reach the style, and only on Android. Without generated headers it
  // stays an OBJECT source, whose own dimensions always reach the style and whose inline `headers`
  // are lifted only on the RN versions that do so — hence the gate.
  const usesGeneratedHeaders =
    requestHeaders.headers.properties.length > 0 && hasObjectProperty(sourceArrayObject, 'headers');
  const arrayDimensionSource = usesGeneratedHeaders && emitsAndroidProps ? sourceArrayObject : undefined;

  return {
    sourceAttributes: [source],
    requestHeaderAttributes: requestHeaders.attributes,
    sourceArray: t.arrayExpression([sourceArrayObject]),
    consumesSizeProps: true,
    androidHeaders: usesGeneratedHeaders
      ? t.cloneNode(requestHeaders.headers, true)
      : getObjectPropertyExpression(sourceArrayObject, 'headers'),
    objectSourceHeaders: !usesGeneratedHeaders,
    width: usesGeneratedHeaders
      ? arrayDimensionSource && getObjectPropertyExpression(arrayDimensionSource, 'width')
      : width,
    height: usesGeneratedHeaders
      ? arrayDimensionSource && getObjectPropertyExpression(arrayDimensionSource, 'height')
      : height,
    arraySourceDimensions: usesGeneratedHeaders,
  };
}

type RequestHeaders = {
  attributes: t.JSXAttribute[];
  headers: t.ObjectExpression;
};

function buildRequestHeaders(attributes: Array<t.JSXAttribute | t.JSXSpreadAttribute>): RequestHeaders | undefined {
  const crossOrigin = findAttribute(attributes, 'crossOrigin');
  const referrerPolicy = findAttribute(attributes, 'referrerPolicy');
  const headerAttributes = [crossOrigin, referrerPolicy].filter(
    (attribute): attribute is t.JSXAttribute => attribute !== undefined
  );

  const headerProperties: t.ObjectProperty[] = [];

  if (crossOrigin) {
    const value = getAttributeValueExpression(crossOrigin);
    if (!t.isStringLiteral(value)) return undefined;
    if (value.value === 'use-credentials') {
      headerProperties.push(
        t.objectProperty(t.stringLiteral('Access-Control-Allow-Credentials'), t.stringLiteral('true'))
      );
    }
  }

  if (referrerPolicy) {
    const value = getAttributeValueExpression(referrerPolicy);
    if (!t.isStringLiteral(value)) return undefined;
    headerProperties.push(t.objectProperty(t.stringLiteral('Referrer-Policy'), t.cloneNode(value, true)));
  }

  return {
    attributes: headerAttributes,
    headers: t.objectExpression(headerProperties),
  };
}

function buildSourceObject(sourceObject: t.ObjectExpression, requestHeaders: RequestHeaders): t.ObjectExpression {
  if (requestHeaders.headers.properties.length === 0) return t.cloneNode(sourceObject, true);

  const uri = getObjectPropertyExpression(sourceObject, 'uri');
  if (!uri || !isStaticTruthyForLogicalOr(uri)) return t.cloneNode(sourceObject, true);

  const nativeSource = t.cloneNode(sourceObject, true);
  nativeSource.properties.push(t.objectProperty(t.identifier('headers'), t.cloneNode(requestHeaders.headers, true)));
  return nativeSource;
}

function buildStyle(
  nativeSource: NativeSource,
  styleInfo: StyleInfo,
  arrayDimensionsGate?: t.Identifier
): t.ArrayExpression {
  const dimensions = t.objectExpression([
    ...(nativeSource.width ? [t.objectProperty(t.identifier('width'), t.cloneNode(nativeSource.width, true))] : []),
    ...(nativeSource.height ? [t.objectProperty(t.identifier('height'), t.cloneNode(nativeSource.height, true))] : []),
  ]);

  return t.arrayExpression([
    arrayDimensionsGate ? t.callExpression(arrayDimensionsGate, [dimensions]) : dimensions,
    t.cloneNode(IMAGE_BASE_STYLE, true),
    ...(styleInfo?.styleExpression ? [styleInfo.styleExpression] : []),
  ]);
}

function buildStaticStyleInfo(attributes: Array<t.JSXAttribute | t.JSXSpreadAttribute>): StyleInfo {
  const styleAttribute = findAttribute(attributes, 'style');
  if (!styleAttribute) return {};
  const styleExpression = getAttributeValueExpression(styleAttribute);
  if (!isStaticLiteralTree(styleExpression)) return null;

  const flattened = flattenStaticStyle(styleExpression);
  if (!flattened) return null;

  const objectFit = flattened.get('objectFit');
  const resizeModeFromObjectFit =
    objectFit && t.isStringLiteral(objectFit) ? OBJECT_FIT_TO_RESIZE_MODE[objectFit.value] : undefined;

  return {
    styleAttribute,
    styleExpression,
    objectFitResizeMode: resizeModeFromObjectFit ? t.stringLiteral(resizeModeFromObjectFit) : undefined,
    styleResizeMode: cloneMapValue(flattened, 'resizeMode'),
    tintColor: cloneMapValue(flattened, 'tintColor'),
  };
}

function flattenStaticStyle(styleExpression: t.Expression): Map<string, t.Expression> | undefined {
  const objects: t.ObjectExpression[] = [];

  const collect = (expression: t.Expression | t.SpreadElement): boolean => {
    if (t.isObjectExpression(expression)) {
      objects.push(expression);
      return true;
    }
    if (t.isArrayExpression(expression)) {
      return expression.elements.every((element) => element == null || (t.isExpression(element) && collect(element)));
    }
    if (
      t.isNullLiteral(expression) ||
      (t.isBooleanLiteral(expression) && expression.value === false) ||
      (t.isNumericLiteral(expression) && expression.value === 0)
    ) {
      return true;
    }
    return false;
  };

  if (!collect(styleExpression)) return undefined;

  const flattened = new Map<string, t.Expression>();
  for (const object of objects) {
    for (const property of object.properties) {
      if (!t.isObjectProperty(property) || property.computed || !t.isExpression(property.value)) return undefined;
      const key = t.isIdentifier(property.key)
        ? property.key.name
        : t.isStringLiteral(property.key)
          ? property.key.value
          : undefined;
      if (!key) return undefined;
      flattened.set(key, property.value);
    }
  }
  return flattened;
}

function hasImageSourceInput(attributes: Array<t.JSXAttribute | t.JSXSpreadAttribute>): boolean {
  return findAttribute(attributes, 'source') !== undefined || findAttribute(attributes, 'src') !== undefined;
}

function getAttributeExpression(
  attributes: Array<t.JSXAttribute | t.JSXSpreadAttribute>,
  name: string
): t.Expression | undefined {
  const attribute = findAttribute(attributes, name);
  return attribute ? getAttributeValueExpression(attribute) : undefined;
}

function getDirectAttributeNames(attributes: Array<t.JSXAttribute | t.JSXSpreadAttribute>): Set<string> {
  const names = new Set<string>();
  for (const attribute of attributes) {
    if (t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name)) {
      names.add(attribute.name.name);
    }
  }
  return names;
}

function findAttribute(
  attributes: Array<t.JSXAttribute | t.JSXSpreadAttribute>,
  name: string
): t.JSXAttribute | undefined {
  return attributes.find(
    (attribute): attribute is t.JSXAttribute =>
      t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name, { name })
  );
}

function getObjectPropertyExpression(object: t.ObjectExpression, name: string): t.Expression | undefined {
  for (const property of object.properties) {
    if (!t.isObjectProperty(property) || !t.isExpression(property.value)) continue;
    if (t.isIdentifier(property.key, { name }) || (t.isStringLiteral(property.key) && property.key.value === name)) {
      return t.cloneNode(property.value, true);
    }
  }
  return undefined;
}

function hasObjectProperty(object: t.ObjectExpression, name: string): boolean {
  return object.properties.some(
    (property) =>
      t.isObjectProperty(property) &&
      (t.isIdentifier(property.key, { name }) || (t.isStringLiteral(property.key) && property.key.value === name))
  );
}

function getFirstSourceHeaders(sourceArray: t.ArrayExpression): t.Expression | undefined {
  const first = sourceArray.elements[0];
  return first && t.isObjectExpression(first) ? getObjectPropertyExpression(first, 'headers') : undefined;
}

function getNullishFallback(
  primary: t.Expression | undefined,
  fallback: t.Expression | undefined
): t.Expression | undefined {
  return primary && !isNullishExpression(primary) ? primary : fallback;
}

function buildResizeMode(explicit: t.Expression | undefined, styleInfo: StyleInfo): t.Expression {
  if (styleInfo?.objectFitResizeMode) return t.cloneNode(styleInfo.objectFitResizeMode, true);

  const fallback =
    styleInfo?.styleResizeMode && !isFalsyForLogicalOr(styleInfo.styleResizeMode)
      ? t.cloneNode(styleInfo.styleResizeMode, true)
      : t.stringLiteral('cover');
  if (!explicit) return fallback;
  if (isFalsyForLogicalOr(explicit)) return fallback;
  if (isStaticTruthyForLogicalOr(explicit)) return t.cloneNode(explicit, true);
  return t.logicalExpression('||', t.cloneNode(explicit, true), fallback);
}

function buildTintColor(
  explicit: t.Expression | undefined,
  styleTintColor: t.Expression | undefined,
  platform?: string
): t.Expression | undefined {
  if (platform === 'android') {
    return explicit && !t.isIdentifier(explicit, { name: 'undefined' }) ? t.cloneNode(explicit, true) : undefined;
  }
  if (!explicit) return styleTintColor ? t.cloneNode(styleTintColor, true) : undefined;
  if (isNullishExpression(explicit)) return styleTintColor ? t.cloneNode(styleTintColor, true) : undefined;
  if (isStaticNonNullishExpression(explicit)) return t.cloneNode(explicit, true);
  return t.logicalExpression(
    '??',
    t.cloneNode(explicit, true),
    styleTintColor ? t.cloneNode(styleTintColor, true) : t.identifier('undefined')
  );
}

function isNullishExpression(expression: t.Expression): boolean {
  return t.isNullLiteral(expression) || t.isIdentifier(expression, { name: 'undefined' });
}

function isFalsyForLogicalOr(expression: t.Expression): boolean {
  return (
    isNullishExpression(expression) ||
    (t.isStringLiteral(expression) && expression.value === '') ||
    (t.isBooleanLiteral(expression) && !expression.value) ||
    (t.isNumericLiteral(expression) && expression.value === 0)
  );
}

function isStaticTruthyForLogicalOr(expression: t.Expression): boolean {
  return (
    (t.isStringLiteral(expression) && expression.value !== '') ||
    (t.isBooleanLiteral(expression) && expression.value) ||
    (t.isNumericLiteral(expression) && expression.value !== 0)
  );
}

function isStaticNonNullishExpression(expression: t.Expression): boolean {
  return t.isStringLiteral(expression) || t.isNumericLiteral(expression) || t.isBooleanLiteral(expression);
}

function cloneMapValue(map: Map<string, t.Expression>, name: string): t.Expression | undefined {
  const value = map.get(name);
  return value ? t.cloneNode(value, true) : undefined;
}

function getAttributeValueExpression(attribute: t.JSXAttribute): t.Expression {
  if (!attribute.value) return t.booleanLiteral(true);
  if (t.isStringLiteral(attribute.value)) return attribute.value;
  if (t.isJSXExpressionContainer(attribute.value)) {
    return t.isJSXEmptyExpression(attribute.value.expression) ? t.booleanLiteral(true) : attribute.value.expression;
  }
  return t.nullLiteral();
}
