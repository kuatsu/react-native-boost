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
  extractSelectableAndUpdateStyle,
  ancestorBailoutChecks,
} from '../../utils/common';
import { ACCESSIBILITY_PROPERTIES, RUNTIME_MODULE_NAME } from '../../utils/constants';

export const textBlacklistedProperties = new Set([
  // The `Text` wrapper translates `aria-hidden` into `accessibilityElementsHidden` /
  // `importantForAccessibility`, which `processAccessibilityProps` does not yet handle. Passing it
  // through would drop it, so bail. TODO: handle this in the runtime helper instead.
  'aria-hidden',
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
  'selectionColor', // TODO: we can use react-native's internal `processColor` to process this at runtime
]);

// `id`/`nativeID` are renamed at build time for direct attributes, but a spread could smuggle either
// through untranslated, so a spread carrying one of these still bails.
const ID_RENAME_KEYS = new Set(['id', 'nativeID']);

/**
 * Props handed off to `processAccessibilityProps` at runtime: the accessibility props plus `disabled`,
 * which `Text` reconciles against `accessibilityState.disabled`. They are collected into a single
 * helper call and stripped from the element so they are not also emitted verbatim.
 */
const NORMALIZED_PROPERTIES = new Set([...ACCESSIBILITY_PROPERTIES, 'disabled']);

/**
 * Type guard for a direct JSX attribute whose name is in {@link NORMALIZED_PROPERTIES}.
 */
const isNormalizedProperty = (attribute: t.JSXAttribute | t.JSXSpreadAttribute): attribute is t.JSXAttribute =>
  t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name) && NORMALIZED_PROPERTIES.has(attribute.name.name);

export const textOptimizer: Optimizer = (path, logger, options, platform) => {
  if (!isValidJSXComponent(path, 'Text')) return;
  if (!isReactNativeImport(path, 'Text')) return;

  const parent = path.parent as t.JSXElement;
  const forced = isForcedLine(path);

  const overridableChecks: BailoutCheck[] = [
    {
      reason: 'contains blacklisted props',
      shouldBail: () => hasBlacklistedProperty(path, textBlacklistedProperties),
    },
    {
      reason: 'has id/nativeID in a spread prop',
      shouldBail: () => hasBlacklistedPropertyInSpread(path, ID_RENAME_KEYS),
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

  // Process props
  fixNegativeNumberOfLines({ path, logger });
  renameIdToNativeID(path);
  addDefaultProperty(path, 'allowFontScaling', t.booleanLiteral(true));
  addDefaultProperty(path, 'ellipsizeMode', t.stringLiteral('tail'));
  processProps(path, file, platform);

  // Replace the Text component with NativeText
  replaceWithNativeComponent(path, parent, file, 'NativeText');
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
 * Fixes negative numberOfLines values by setting them to 0.
 */
function fixNegativeNumberOfLines({ path, logger }: { path: NodePath<t.JSXOpeningElement>; logger: PluginLogger }) {
  for (const attribute of path.node.attributes) {
    if (
      t.isJSXAttribute(attribute) &&
      t.isJSXIdentifier(attribute.name, { name: 'numberOfLines' }) &&
      attribute.value &&
      t.isJSXExpressionContainer(attribute.value)
    ) {
      let originalValue: number | undefined;
      if (t.isNumericLiteral(attribute.value.expression)) {
        originalValue = attribute.value.expression.value;
      } else if (
        t.isUnaryExpression(attribute.value.expression) &&
        attribute.value.expression.operator === '-' &&
        t.isNumericLiteral(attribute.value.expression.argument)
      ) {
        originalValue = -attribute.value.expression.argument.value;
      }
      if (originalValue !== undefined && originalValue < 0) {
        logger.warning({
          component: 'Text',
          path,
          message: `'numberOfLines' must be a non-negative number, received: ${originalValue}. The value will be set to 0.`,
        });
        attribute.value.expression = t.numericLiteral(0);
      }
    }
  }
}

/**
 * Processes style and accessibility attributes, replacing them with optimized versions.
 */
function processProps(path: NodePath<t.JSXOpeningElement>, file: HubFile, platform?: string) {
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
  // 1. Prepare spread attributes (a11y / style)
  // ============================================

  const spreadAttributes: t.JSXSpreadAttribute[] = [];

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
    spreadAttributes.push(t.jsxSpreadAttribute(accessibilityExpr));
  }

  // --- Style ---
  let selectableAttribute: t.JSXAttribute | undefined;
  if (styleExpr) {
    // Attempt a compile-time extraction of `userSelect`
    const selectableValue = extractSelectableAndUpdateStyle(styleExpr);

    if (selectableValue != null) {
      selectableAttribute = t.jsxAttribute(
        t.jsxIdentifier('selectable'),
        t.jsxExpressionContainer(t.booleanLiteral(selectableValue))
      );
    }

    const flattenIdentifier = addFileImportHint({
      file,
      nameHint: 'processTextStyle',
      path,
      importName: 'processTextStyle',
      moduleName: RUNTIME_MODULE_NAME,
    });
    const flattenedStyleExpr = t.callExpression(t.identifier(flattenIdentifier.name), [styleExpr]);
    spreadAttributes.push(t.jsxSpreadAttribute(flattenedStyleExpr));
  }

  // ============================================
  // 2. Collect the remaining (non-processed) attributes
  // ============================================
  const remainingAttributes: (t.JSXAttribute | t.JSXSpreadAttribute)[] = [];

  for (const attribute of currentAttributes) {
    // Skip the style attribute (we have replaced it with a spread)
    if (styleAttribute && attribute === styleAttribute) continue;

    // Skip the props we routed through `processAccessibilityProps`
    if (shouldNormalize && isNormalizedProperty(attribute)) continue;

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

  path.node.attributes = [...spreadAttributes, selectableAttribute, ...remainingAttributes, accessibleAttribute].filter(
    (attribute): attribute is t.JSXAttribute | t.JSXSpreadAttribute => attribute !== undefined
  );
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
