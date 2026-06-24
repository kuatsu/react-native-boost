import { NodePath, types as t } from '@babel/core';
import { HubFile, Optimizer, PluginLogger } from '../../types';
import PluginError from '../../utils/plugin-error';
import { BailoutCheck, getFirstBailoutReason } from '../../utils/helpers';
import {
  addDefaultProperty,
  addFileImportHint,
  buildPropertiesFromAttributes,
  hasAccessibilityProperty,
  hasAmbiguousIdNativeID,
  hasBlacklistedProperty,
  hasBlacklistedPropertyInSpread,
  isForcedLine,
  isIgnoredLine,
  isValidJSXComponent,
  isReactNativeImport,
  renameIdToNativeID,
  replaceWithNativeComponent,
  isPrimitiveChild,
  hasExpoRouterLinkParentWithAsChild,
  extractStyleAttribute,
  extractSelectionColor,
  extractSelectableAndUpdateStyle,
  tryBuildStaticTextStyle,
  ancestorBailoutChecks,
  classifyStyleOrigin,
  StyleOrigin,
} from '../../utils/common';
import { ACCESSIBILITY_PROPERTIES, RUNTIME_MODULE_NAME, UNISTYLES_NATIVE_TEXT_MODULE } from '../../utils/constants';

export const textBlacklistedProperties = new Set([
  'onLongPress',
  'onPress',
  'onPressIn',
  'onPressOut',
  'onResponderGrant',
  'onResponderMove',
  'onResponderRelease',
  'onResponderTerminate',
  'onResponderTerminationRequest',
  'onStartShouldSetResponder',
  'pressRetentionOffset',
  'suppressHighlighting',
]);

/**
 * Props handed off to `processAccessibilityProps` at runtime: the accessibility props plus `disabled`
 * (reconciled against `accessibilityState.disabled`) and the explicit `accessibilityElementsHidden` /
 * `importantForAccessibility` natives that `aria-hidden` reconciles against — collecting them lets the
 * helper own the `aria-hidden` precedence instead of leaving them as direct attributes that would
 * override the leading helper spread. They are collected into a single helper call and stripped from
 * the element so they are not also emitted verbatim.
 */
const NORMALIZED_PROPERTIES = new Set([
  ...ACCESSIBILITY_PROPERTIES,
  'disabled',
  'accessibilityElementsHidden',
  'importantForAccessibility',
]);

/**
 * Props the optimizer normalizes, translates, renames, or clamps for direct attributes but cannot reach
 * inside a spread. A spread that may carry any of these forces a bail — an unresolvable spread bails
 * unconditionally, a resolvable one bails only when its object literal contains a guarded key — deferring
 * to the wrapper, which handles them correctly. Mirrors View's `VIEW_SPREAD_GUARD_KEYS`.
 *
 * TODO: rather than bail, route a resolvable spread's contents through `processAccessibilityProps` /
 * `processTextStyle` (and the `numberOfLines` clamp) so these elements keep optimizing. Deferred because
 * it requires replicating RN's spread→direct merge precedence across the a11y merge, `disabled`
 * reconciliation, and style.
 */
const TEXT_SPREAD_GUARD_KEYS = new Set([
  ...NORMALIZED_PROPERTIES,
  'style',
  'numberOfLines',
  'id',
  'nativeID',
  'selectionColor',
]);

/**
 * Type guard for a direct JSX attribute whose name is in {@link NORMALIZED_PROPERTIES}.
 */
const isNormalizedProperty = (attribute: t.JSXAttribute | t.JSXSpreadAttribute): attribute is t.JSXAttribute =>
  t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name) && NORMALIZED_PROPERTIES.has(attribute.name.name);

export const textOptimizer: Optimizer = (path, logger, options, platform, unistylesEnabled) => {
  if (!isValidJSXComponent(path, 'Text')) return;
  if (!isReactNativeImport(path, 'Text')) return;

  const parent = path.parent as t.JSXElement;
  const forced = isForcedLine(path);

  // In Unistyles mode, classify the direct `style` origin (lazily, once). A `style` carried by a spread
  // is already guarded (`style` ∈ TEXT_SPREAD_GUARD_KEYS), so only the direct attribute is classified.
  let styleOrigin: StyleOrigin | undefined;
  const getStyleOrigin = (): StyleOrigin => {
    if (!unistylesEnabled) return 'plain';
    return (styleOrigin ??= classifyStyleOrigin(path, extractStyleAttribute(path.node.attributes).styleExpr));
  };

  const overridableChecks: BailoutCheck[] = [
    {
      reason: 'contains blacklisted props',
      shouldBail: () => hasBlacklistedProperty(path, textBlacklistedProperties),
    },
    {
      reason: 'has a spread that may carry a translated, normalized, or clamped prop',
      shouldBail: () => hasBlacklistedPropertyInSpread(path, TEXT_SPREAD_GUARD_KEYS),
    },
    {
      reason: 'has an unresolved style source that may be a Unistyles style',
      shouldBail: () => getStyleOrigin() === 'unknown',
    },
    {
      reason: 'has both a dynamic `id` and a `nativeID` (ambiguous precedence)',
      shouldBail: () => hasAmbiguousIdNativeID(path),
    },
    {
      reason: 'is a direct child of expo-router Link with asChild',
      shouldBail: () => hasExpoRouterLinkParentWithAsChild(path),
    },
    // The local children check runs before the ancestor checks because it is cheap and prunes the
    // common nested-element `Text` before the unbounded ancestor walk those checks trigger.
    {
      reason: 'contains non-primitive children',
      shouldBail: () => hasInvalidChildren(path, parent),
    },
    ...ancestorBailoutChecks(path, options?.dangerouslyOptimizeTextWithUnknownAncestors === true),
  ];

  if (forced) {
    const overriddenReason = getFirstBailoutReason(overridableChecks);

    if (overriddenReason) {
      logger.forced({ component: 'Text', path, reason: overriddenReason });
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
      logger.skipped({ component: 'Text', path, reason: skipReason });
      return;
    }
  }

  const hub = path.hub as unknown;
  const file = typeof hub === 'object' && hub !== null && 'file' in hub ? (hub.file as HubFile) : undefined;

  if (!file) {
    throw new PluginError('No file found in Babel hub');
  }

  logger.optimized({
    component: 'Text',
    path,
  });

  const routeToUnistyles = getStyleOrigin() === 'unistyles';

  // Process props
  fixNegativeNumberOfLines({ path, logger, file });
  renameIdToNativeID(path);
  addDefaultProperty(path, 'allowFontScaling', t.booleanLiteral(true));
  addDefaultProperty(path, 'ellipsizeMode', t.stringLiteral('tail'));
  processProps(path, file, platform, routeToUnistyles);

  // A Unistyles-styled Text routes to Unistyles' lean host (a registering wrapper around `RCTText`); its
  // `style` is passed by identity (see `processProps`) so the Unistyles native-state — and therefore the
  // shadow-tree registration — survives. Plain text optimizes to Boost's own raw host as usual.
  if (routeToUnistyles) {
    replaceWithNativeComponent(path, parent, file, 'NativeText', {
      moduleName: UNISTYLES_NATIVE_TEXT_MODULE,
      importName: 'NativeText',
      nameHint: 'UnistylesNativeText',
    });
  } else {
    replaceWithNativeComponent(path, parent, file, 'NativeText');
  }
};

/**
 * Checks if the Text component has any invalid children or blacklisted properties.
 * This function combines the checks for both attribute-based children and JSX children.
 *
 * @param path - The path to the JSXOpeningElement.
 * @param parent - The parent JSX element.
 * @returns true if the component has invalid children or blacklisted properties.
 */
function hasInvalidChildren(path: NodePath<t.JSXOpeningElement>, parent: t.JSXElement): boolean {
  for (const attribute of path.node.attributes) {
    if (t.isJSXSpreadAttribute(attribute)) continue; // Spread attributes are handled in hasBlacklistedProperty

    if (
      t.isJSXIdentifier(attribute.name) &&
      attribute.value &&
      // For a "children" attribute, optimization is allowed only if it is a provable primitive
      attribute.name.name === 'children' &&
      !isPrimitiveChild(path, attribute.value)
    ) {
      return true;
    }
  }

  // Return true if any child is not a provably-primitive node
  return !parent.children.every((child) => isPrimitiveChild(path, child));
}

/**
 * Replicates `Text`'s non-negative `numberOfLines` rule. A literal value is clamped at build time — a
 * negative becomes `0` with a compile-time warning, a non-negative is left untouched. A non-literal value
 * (its sign unknowable at build time) is wrapped in the runtime `clampNumberOfLines` helper, which mirrors
 * RN exactly (negative/`NaN` → `0`; `null`/`undefined` untouched).
 */
function fixNegativeNumberOfLines({
  path,
  logger,
  file,
}: {
  path: NodePath<t.JSXOpeningElement>;
  logger: PluginLogger;
  file: HubFile;
}) {
  for (const attribute of path.node.attributes) {
    if (
      !t.isJSXAttribute(attribute) ||
      !t.isJSXIdentifier(attribute.name, { name: 'numberOfLines' }) ||
      !attribute.value ||
      !t.isJSXExpressionContainer(attribute.value) ||
      !t.isExpression(attribute.value.expression)
    ) {
      continue;
    }

    const expression = attribute.value.expression;
    const literalValue = staticNumberOfLines(expression);

    if (literalValue !== undefined) {
      if (literalValue < 0) {
        logger.warning({
          component: 'Text',
          path,
          message: `'numberOfLines' must be a non-negative number, received: ${literalValue}. The value will be set to 0.`,
        });
        attribute.value.expression = t.numericLiteral(0);
      }
      continue;
    }

    const clampIdentifier = addFileImportHint({
      file,
      nameHint: 'clampNumberOfLines',
      path,
      importName: 'clampNumberOfLines',
      moduleName: RUNTIME_MODULE_NAME,
    });
    attribute.value.expression = t.callExpression(t.identifier(clampIdentifier.name), [expression]);
  }
}

/**
 * The build-time numeric value of a `numberOfLines` expression when it is a numeric literal or a
 * unary-minus numeric literal; `undefined` for any other (non-literal) expression.
 */
function staticNumberOfLines(expression: t.Expression): number | undefined {
  if (t.isNumericLiteral(expression)) return expression.value;
  if (t.isUnaryExpression(expression) && expression.operator === '-' && t.isNumericLiteral(expression.argument)) {
    return -expression.argument.value;
  }
  return undefined;
}

/**
 * Processes style and accessibility attributes, replacing them with optimized versions.
 *
 * When `passStyleByIdentity` is set (Unistyles routing), the `style` attribute is left exactly as
 * written instead of being flattened/normalized through `processTextStyle` — flattening would strip the
 * Unistyles native-state the engine needs. Accessibility, `selectionColor`, and the `accessible` default
 * are still applied (they do not touch `style`). The skipped text normalizations (numeric `fontWeight`,
 * `verticalAlign`, `userSelect` → `selectable`) cannot be reproduced safely here: for a reactive style
 * Unistyles' C++ engine re-commits the raw parsed values on every update, overwriting any JS-side
 * normalization, so matching Unistyles' own lean-host semantics (raw pass-through) is the correct contract.
 */
function processProps(
  path: NodePath<t.JSXOpeningElement>,
  file: HubFile,
  platform?: string,
  passStyleByIdentity = false
) {
  // Grab the up-to-date list of attributes
  const currentAttributes = [...path.node.attributes];

  const { styleExpr, styleAttribute } = extractStyleAttribute(currentAttributes);

  // `Text` always resolves a platform-specific `accessible` default and reconciles `disabled` with
  // `accessibilityState.disabled`. When any accessibility prop or `disabled` is present we hand the
  // element off to `processAccessibilityProps` (which also performs the aria/label merges); otherwise
  // only the `accessible` default is needed, so we inject it directly to keep the common path cheap.
  const shouldNormalize =
    hasAccessibilityProperty(path, currentAttributes) ||
    currentAttributes.some(
      (attribute) => t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name, { name: 'disabled' })
    );

  // ============================================
  // 1. Prepare the accessibility & style transforms
  // ============================================

  let accessibilitySpread: t.JSXSpreadAttribute | undefined;

  // --- Accessibility & `disabled` ---
  if (shouldNormalize) {
    const normalizedAttributes = currentAttributes.filter((attribute) => isNormalizedProperty(attribute));

    const normalizeIdentifier = addFileImportHint({
      file,
      nameHint: 'processAccessibilityProps',
      path,
      importName: 'processAccessibilityProps',
      moduleName: RUNTIME_MODULE_NAME,
    });

    const accessibilityObject = buildPropertiesFromAttributes(normalizedAttributes);
    const accessibilityExpr = t.callExpression(t.identifier(normalizeIdentifier.name), [accessibilityObject]);
    accessibilitySpread = t.jsxSpreadAttribute(accessibilityExpr);
  }

  // --- Style ---
  // `Text` lets a `userSelect` in the style override a direct `selectable` prop. When the style is static
  // enough to read `userSelect` at build time we emit the derived `selectable` as a literal and drop the
  // now-dead direct prop; when it is only knowable at runtime, the `processTextStyle` spread carries
  // the override and is emitted last so it still wins over the direct prop.
  let selectableAttribute: t.JSXAttribute | undefined;
  let staticStyleAttribute: t.JSXAttribute | undefined;
  let styleSpread: t.JSXSpreadAttribute | undefined;
  // `passStyleByIdentity` (Unistyles routing) skips all style transforms — the original `style`
  // attribute is left untouched in the collected attributes below so it reaches the native host intact.
  if (styleExpr && !passStyleByIdentity) {
    const selectableValue = extractSelectableAndUpdateStyle(styleExpr);

    if (selectableValue != null) {
      selectableAttribute = t.jsxAttribute(
        t.jsxIdentifier('selectable'),
        t.jsxExpressionContainer(t.booleanLiteral(selectableValue))
      );
    }

    // A fully static style is normalized at build time and emitted as a direct `style={...}` object,
    // dropping the per-render `processTextStyle` call. Dynamic styles still go through the runtime
    // helper, where the WeakMap reference cache and `StyleSheet.flatten` are the actual win.
    const staticStyle = tryBuildStaticTextStyle(styleExpr);
    if (staticStyle) {
      staticStyleAttribute = t.jsxAttribute(t.jsxIdentifier('style'), t.jsxExpressionContainer(staticStyle));
    } else {
      const flattenIdentifier = addFileImportHint({
        file,
        nameHint: 'processTextStyle',
        path,
        importName: 'processTextStyle',
        moduleName: RUNTIME_MODULE_NAME,
      });
      const flattenedStyleExpr = t.callExpression(t.identifier(flattenIdentifier.name), [styleExpr]);
      styleSpread = t.jsxSpreadAttribute(flattenedStyleExpr);
    }
  }

  // --- selectionColor ---
  // `Text` runs `selectionColor` through `processColor` before handing it to its native host (a CSS color
  // string / `PlatformColor` becomes the packed value the host expects). We reproduce that single
  // normalization at runtime via a `processSelectionColor` spread, mirroring the `processTextStyle`
  // mechanism — any expression flows through unchanged, so no `@boost-force` is needed for a dynamic
  // value. A spread-carried `selectionColor` bails upstream (`TEXT_SPREAD_GUARD_KEYS`) rather than
  // forwarding the prop un-normalized.
  const { selectionColorAttribute, selectionColorExpr } = extractSelectionColor(currentAttributes);
  let selectionColorSpread: t.JSXSpreadAttribute | undefined;
  if (selectionColorExpr) {
    const selectionColorIdentifier = addFileImportHint({
      file,
      nameHint: 'processSelectionColor',
      path,
      importName: 'processSelectionColor',
      moduleName: RUNTIME_MODULE_NAME,
    });
    selectionColorSpread = t.jsxSpreadAttribute(
      t.callExpression(t.identifier(selectionColorIdentifier.name), [selectionColorExpr])
    );
  }

  // ============================================
  // 2. Collect the remaining (non-processed) attributes
  // ============================================
  const remainingAttributes: (t.JSXAttribute | t.JSXSpreadAttribute)[] = [];

  for (const attribute of currentAttributes) {
    // Skip the style attribute (we have replaced it with a `style` object or `processTextStyle` spread).
    // When passing the style by identity (Unistyles routing) it is retained here, untouched.
    if (!passStyleByIdentity && styleAttribute && attribute === styleAttribute) continue;

    // Skip the props we routed through `processAccessibilityProps`
    if (shouldNormalize && isNormalizedProperty(attribute)) continue;

    // Skip the selectionColor attribute (replaced with a `processSelectionColor` spread)
    if (selectionColorAttribute && attribute === selectionColorAttribute) continue;

    // A build-time `userSelect`-derived `selectable` supersedes a direct `selectable` (RN's rule), so
    // drop the now-dead direct prop instead of emitting it alongside the derived literal.
    if (
      selectableAttribute &&
      t.isJSXAttribute(attribute) &&
      t.isJSXIdentifier(attribute.name, { name: 'selectable' })
    ) {
      continue;
    }

    remainingAttributes.push(attribute);
  }

  // ============================================
  // 3. `accessible` default for the common path
  // ============================================
  // With no accessibility/`disabled` prop the helper is skipped, but `Text` still applies a
  // platform-specific `accessible` default. We build it explicitly (rather than via `addDefaultProperty`,
  // which gives up when it hits the unresolvable `{...processTextStyle(...)}` spread and would silently
  // drop the default on styled text). The cheap path guarantees no `accessible` is already set — any
  // such prop would have set `shouldNormalize`, and unresolvable spreads bail before this point — so
  // appending it unconditionally is safe.
  const accessibleAttribute = shouldNormalize ? undefined : buildAccessibleDefault(path, file, platform);

  // ============================================
  // 4. Assemble the final attribute list
  // ============================================
  // `styleSpread` (the runtime `processTextStyle` call) is emitted AFTER the direct attributes so a
  // `userSelect`-derived `selectable` it computes at runtime overrides a direct `selectable`, mirroring
  // `Text`'s late `userSelect` override. `selectionColorSpread` writes a disjoint key (`selectionColor`),
  // so its position is free — it leads for readability.
  path.node.attributes = [
    selectionColorSpread,
    accessibilitySpread,
    selectableAttribute,
    staticStyleAttribute,
    ...remainingAttributes,
    styleSpread,
    accessibleAttribute,
  ].filter((attribute): attribute is t.JSXAttribute | t.JSXSpreadAttribute => attribute !== undefined);
}

/**
 * Builds the `accessible` default attribute `Text` applies when the prop is omitted: `true` on iOS,
 * `false` on Android, omitted on web. Metro bundles per platform and reports the target on the Babel
 * caller, so a known platform is inlined as a literal; an unknown platform (non-Metro bundlers,
 * fixture tests) defers to the lightweight runtime resolver. Returns `undefined` when nothing should
 * be emitted.
 */
function buildAccessibleDefault(
  path: NodePath<t.JSXOpeningElement>,
  file: HubFile,
  platform?: string
): t.JSXAttribute | undefined {
  if (platform === 'web') return undefined;

  let value: t.Expression;
  if (platform === 'ios' || platform === 'android') {
    value = t.booleanLiteral(platform === 'ios');
  } else {
    const accessibleIdentifier = addFileImportHint({
      file,
      nameHint: 'getDefaultTextAccessible',
      path,
      importName: 'getDefaultTextAccessible',
      moduleName: RUNTIME_MODULE_NAME,
    });
    value = t.callExpression(t.identifier(accessibleIdentifier.name), []);
  }

  return t.jsxAttribute(t.jsxIdentifier('accessible'), t.jsxExpressionContainer(value));
}
