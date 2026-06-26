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
  isReactNativeImport,
  isStaticLiteralTree,
  isValidJSXComponent,
  replaceWithNativeComponent,
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

const IMAGE_BASE_STYLE = t.objectExpression([t.objectProperty(t.identifier('overflow'), t.stringLiteral('hidden'))]);

const OBJECT_FIT_TO_RESIZE_MODE: Record<string, string> = {
  'contain': 'contain',
  'cover': 'cover',
  'fill': 'stretch',
  'none': 'none',
  'scale-down': 'contain',
};

export const imageOptimizer: Optimizer = (path, logger, _options, platform) => {
  if (platform === 'web') return;
  if (!isValidJSXComponent(path, 'Image')) return;
  if (!isReactNativeImport(path, 'Image')) return;

  const parent = path.parent as t.JSXElement;
  const forced = isForcedLine(path);

  const overridableChecks: BailoutCheck[] = [
    {
      reason: 'contains unsupported Image props',
      shouldBail: () => hasBlacklistedProperty(path, IMAGE_BAILOUT_PROPS),
    },
    {
      reason: 'has a spread that may carry translated Image request headers',
      shouldBail: () => hasBlacklistedPropertyInSpread(path, IMAGE_REQUEST_HEADER_PROPS),
    },
    {
      reason: 'has a spread that may carry translated Image accessibility props',
      shouldBail: () => hasImageAccessibilitySpreadConflict(path),
    },
    {
      reason: 'contains non-empty children',
      shouldBail: () => parent.children.some((child) => !t.isJSXText(child) || child.value.trim() !== ''),
    },
    {
      reason: 'has an unsupported or dynamic source',
      shouldBail: () => buildNativeSource(path.node.attributes) == null,
    },
    {
      reason: 'has dynamic image style',
      shouldBail: () =>
        getStyleExpression(path.node.attributes) != null && buildStaticStyleInfo(path.node.attributes) == null,
    },
  ];

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

  const nativeSource = buildNativeSource(path.node.attributes);
  const styleInfo = buildStaticStyleInfo(path.node.attributes);
  if (!nativeSource || styleInfo === null) return;

  logger.optimized({ component: 'Image', path });

  processImageProps(path, file, nativeSource, styleInfo);
  replaceWithNativeComponent(path, parent, file, 'NativeImage');
};

type NativeSource = {
  sourceAttribute: t.JSXAttribute;
  requestHeaderAttributes: t.JSXAttribute[];
  sourceArray: t.ArrayExpression;
  consumesSizeProps: boolean;
  width?: t.Expression;
  height?: t.Expression;
};

type StyleInfo = {
  styleAttribute?: t.JSXAttribute;
  styleExpression?: t.Expression;
  resizeMode?: t.Expression;
  tintColor?: t.Expression;
} | null;

type ImageAccessibilityInfo = {
  attributes: t.JSXAttribute[];
  spreadAttribute: t.JSXSpreadAttribute;
};

function processImageProps(
  path: NodePath<t.JSXOpeningElement>,
  file: HubFile,
  nativeSource: NativeSource,
  styleInfo: StyleInfo
) {
  const accessibilityInfo = buildImageAccessibilityInfo(path, file);
  const consumed = new Set<t.JSXAttribute>([
    nativeSource.sourceAttribute,
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

  path.node.attributes = [
    ...remaining,
    accessibilityInfo?.spreadAttribute,
    makeAttribute('style', buildStyle(nativeSource, styleInfo)),
    makeAttribute('source', nativeSource.sourceArray),
    makeAttribute('resizeMode', explicitResizeMode ?? styleInfo?.resizeMode ?? t.stringLiteral('cover')),
    explicitTintColor || styleInfo?.tintColor
      ? makeAttribute('tintColor', explicitTintColor ?? styleInfo!.tintColor!)
      : undefined,
  ].filter((attribute): attribute is t.JSXAttribute | t.JSXSpreadAttribute => attribute !== undefined);
}

function hasImageAccessibilitySpreadConflict(path: NodePath<t.JSXOpeningElement>): boolean {
  const directNames = getDirectAttributeNames(path.node.attributes);
  const guarded = new Set(['alt', 'aria-hidden', 'aria-label', 'aria-labelledby', ...IMAGE_ARIA_STATE_PROPS]);

  if (directNames.has('alt') || directNames.has('aria-label')) {
    guarded.add('accessibilityLabel');
  }
  if (directNames.has('alt') || directNames.has('aria-hidden')) {
    guarded.add('accessible');
  }
  if (directNames.has('aria-hidden')) guarded.add('importantForAccessibility');
  if (directNames.has('aria-labelledby')) guarded.add('accessibilityLabelledBy');
  if ([...IMAGE_ARIA_STATE_PROPS].some((name) => directNames.has(name))) {
    guarded.add('accessibilityState');
  }

  return hasBlacklistedPropertyInSpread(path, guarded);
}

function buildImageAccessibilityInfo(
  path: NodePath<t.JSXOpeningElement>,
  file: HubFile
): ImageAccessibilityInfo | undefined {
  const directNames = getDirectAttributeNames(path.node.attributes);
  const hasAlt = directNames.has('alt');
  const hasLabelTrigger = hasAlt || directNames.has('aria-label');
  const hasHiddenTrigger = directNames.has('aria-hidden');
  const hasLabelledByTrigger = directNames.has('aria-labelledby');
  const hasStateTrigger = [...IMAGE_ARIA_STATE_PROPS].some((name) => directNames.has(name));

  if (!hasLabelTrigger && !hasHiddenTrigger && !hasLabelledByTrigger && !hasStateTrigger) return undefined;

  const helperNames = new Set<string>();
  if (hasLabelTrigger) {
    helperNames.add('alt');
    helperNames.add('aria-label');
    helperNames.add('accessibilityLabel');
  }
  if (hasAlt) {
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

function buildNativeSource(attributes: Array<t.JSXAttribute | t.JSXSpreadAttribute>): NativeSource | undefined {
  const requestHeaders = buildRequestHeaders(attributes);
  if (!requestHeaders) return undefined;

  const src = findAttribute(attributes, 'src');
  if (src) {
    const uri = getAttributeValueExpression(src);
    const width = getAttributeExpression(attributes, 'width');
    const height = getAttributeExpression(attributes, 'height');
    return {
      sourceAttribute: src,
      requestHeaderAttributes: requestHeaders.attributes,
      sourceArray: t.arrayExpression([
        t.objectExpression([
          t.objectProperty(t.identifier('uri'), uri),
          t.objectProperty(t.identifier('headers'), t.cloneNode(requestHeaders.headers, true)),
          ...(width ? [t.objectProperty(t.identifier('width'), width)] : []),
          ...(height ? [t.objectProperty(t.identifier('height'), height)] : []),
        ]),
      ]),
      consumesSizeProps: true,
      width,
      height,
    };
  }

  const source = findAttribute(attributes, 'source');
  if (!source || !t.isJSXExpressionContainer(source.value)) return undefined;
  const sourceExpression = source.value.expression;
  if (!t.isObjectExpression(sourceExpression) && !t.isArrayExpression(sourceExpression)) return undefined;
  if (!isStaticLiteralTree(sourceExpression)) return undefined;

  if (t.isArrayExpression(sourceExpression)) {
    if (requestHeaders.attributes.length > 0) return undefined;
    return {
      sourceAttribute: source,
      requestHeaderAttributes: requestHeaders.attributes,
      sourceArray: t.cloneNode(sourceExpression, true),
      consumesSizeProps: false,
    };
  }

  const sourceObject = sourceExpression;
  const sourceWidth = getObjectPropertyExpression(sourceObject, 'width');
  const sourceHeight = getObjectPropertyExpression(sourceObject, 'height');
  const width = sourceWidth ?? getAttributeExpression(attributes, 'width');
  const height = sourceHeight ?? getAttributeExpression(attributes, 'height');

  return {
    sourceAttribute: source,
    requestHeaderAttributes: requestHeaders.attributes,
    sourceArray: t.arrayExpression([buildSourceObject(sourceObject, requestHeaders)]),
    consumesSizeProps: true,
    width,
    height,
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
  if (!uri || (t.isStringLiteral(uri) && uri.value === '')) return t.cloneNode(sourceObject, true);

  const nativeSource = t.cloneNode(sourceObject, true);
  nativeSource.properties.push(t.objectProperty(t.identifier('headers'), t.cloneNode(requestHeaders.headers, true)));
  return nativeSource;
}

function buildStyle(nativeSource: NativeSource, styleInfo: StyleInfo): t.ArrayExpression {
  return t.arrayExpression([
    t.objectExpression([
      ...(nativeSource.width ? [t.objectProperty(t.identifier('width'), t.cloneNode(nativeSource.width, true))] : []),
      ...(nativeSource.height
        ? [t.objectProperty(t.identifier('height'), t.cloneNode(nativeSource.height, true))]
        : []),
    ]),
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
  const resizeMode = resizeModeFromObjectFit
    ? t.stringLiteral(resizeModeFromObjectFit)
    : cloneMapValue(flattened, 'resizeMode');

  return {
    styleAttribute,
    styleExpression,
    resizeMode,
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

function getStyleExpression(attributes: Array<t.JSXAttribute | t.JSXSpreadAttribute>): t.Expression | undefined {
  const style = findAttribute(attributes, 'style');
  return style ? getAttributeValueExpression(style) : undefined;
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

function makeAttribute(name: string, value: t.Expression): t.JSXAttribute {
  return t.jsxAttribute(t.jsxIdentifier(name), t.isStringLiteral(value) ? value : t.jsxExpressionContainer(value));
}
