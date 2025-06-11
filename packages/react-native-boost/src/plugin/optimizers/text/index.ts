import { NodePath, types as t } from '@babel/core';
import { HubFile, Optimizer } from '../../types';
import PluginError from '../../utils/plugin-error';
import {
  addDefaultProperty,
  addFileImportHint,
  buildPropertiesFromAttributes,
  hasAccessibilityProperty,
  hasBlacklistedProperty,
  isIgnoredLine,
  isValidJSXComponent,
  isReactNativeImport,
  replaceWithNativeComponent,
  isStringNode,
} from '../../utils/common';
import { RUNTIME_MODULE_NAME } from '../../utils/constants';
import { ACCESSIBILITY_PROPERTIES } from '../../utils/constants';
import { extractStyleAttribute, extractSelectableAndUpdateStyle } from '../../utils/common';

export const textBlacklistedProperties = new Set([
  'id',
  'nativeID',
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

export const textOptimizer: Optimizer = (path, log = () => {}) => {
  if (isIgnoredLine(path)) return;
  if (!isValidJSXComponent(path, 'Text')) return;
  if (!isReactNativeImport(path, 'Text')) return;
  if (hasBlacklistedProperty(path, textBlacklistedProperties)) return;

  // Verify that the Text only has string children
  const parent = path.parent as t.JSXElement;
  if (hasInvalidChildren(path, parent)) return;

  const hub = path.hub as unknown;
  const file = typeof hub === 'object' && hub !== null && 'file' in hub ? (hub.file as HubFile) : undefined;

  if (!file) {
    throw new PluginError('No file found in Babel hub');
  }

  const filename = file.opts?.filename || 'unknown file';
  const lineNumber = path.node.loc?.start.line ?? 'unknown line';
  log(`Optimizing Text component in ${filename}:${lineNumber}`);

  // Process props
  fixNegativeNumberOfLines({ path, log });
  addDefaultProperty(path, 'allowFontScaling', t.booleanLiteral(true));
  addDefaultProperty(path, 'ellipsizeMode', t.stringLiteral('tail'));
  processProps(path, file);

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
      // For a "children" attribute, optimization is allowed only if it is a string
      attribute.name.name === 'children' &&
      !isStringNode(path, attribute.value)
    ) {
      return true;
    }
  }

  // Return true if any child is not a string node
  return !parent.children.every((child) => isStringNode(path, child));
}

/**
 * Fixes negative numberOfLines values by setting them to 0.
 */
function fixNegativeNumberOfLines({
  path,
  log,
}: {
  path: NodePath<t.JSXOpeningElement>;
  log: (message: string) => void;
}) {
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
        log(
          `Warning: 'numberOfLines' in <Text> must be a non-negative number, received: ${originalValue}. The value will be set to 0.`
        );
        attribute.value.expression = t.numericLiteral(0);
      }
    }
  }
}

/**
 * Processes style and accessibility attributes, replacing them with optimized versions.
 */
function processProps(path: NodePath<t.JSXOpeningElement>, file: HubFile) {
  // Grab the up-to-date list of attributes
  const currentAttributes = [...path.node.attributes];

  const { styleExpr, styleAttribute } = extractStyleAttribute(currentAttributes);
  const hasA11y = hasAccessibilityProperty(path, currentAttributes);

  // ============================================
  // 1. Prepare spread attributes (style / a11y)
  // ============================================

  const spreadAttributes: t.JSXSpreadAttribute[] = [];

  // --- Accessibility ---
  if (hasA11y) {
    const accessibilityAttributes = currentAttributes.filter((attribute) => {
      if (!t.isJSXAttribute(attribute)) return false;
      return t.isJSXIdentifier(attribute.name) && ACCESSIBILITY_PROPERTIES.has(attribute.name.name as string);
    });

    const normalizeIdentifier = addFileImportHint({
      file,
      nameHint: 'processAccessibilityProps',
      path,
      importName: 'processAccessibilityProps',
      moduleName: RUNTIME_MODULE_NAME,
    });

    const accessibilityObject = buildPropertiesFromAttributes(accessibilityAttributes);
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

    // Skip accessibility attributes if we processed them
    if (
      hasA11y &&
      t.isJSXAttribute(attribute) &&
      t.isJSXIdentifier(attribute.name) &&
      ACCESSIBILITY_PROPERTIES.has(attribute.name.name as string)
    ) {
      continue;
    }

    remainingAttributes.push(attribute);
  }

  path.node.attributes = [...spreadAttributes, selectableAttribute, ...remainingAttributes].filter(
    (attribute): attribute is t.JSXAttribute | t.JSXSpreadAttribute => attribute !== undefined
  );
}
