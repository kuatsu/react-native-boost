import { NodePath, types as t } from '@babel/core';
import { HubFile, Optimizer } from '../../types';
import PluginError from '../../utils/plugin-error';
import {
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

export const textBlacklistedProperties = new Set([
  'allowFontScaling',
  'ellipsizeMode',
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
  'selectable',
  'selectionColor',
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
  const originalAttributes = [...path.node.attributes];
  fixNegativeNumberOfLines({ path, log });
  processProps(path, file, originalAttributes);

  // Replace the Text component with NativeText
  replaceWithNativeComponent(path, parent, file, 'NativeText', 'Text', 'react-native-boost');
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
 * Extracts the style attribute from JSX attributes.
 */
function extractStyleAttribute(attributes: Array<t.JSXAttribute | t.JSXSpreadAttribute>): {
  styleAttribute?: t.JSXAttribute;
  styleExpr?: t.Expression;
} {
  for (const attribute of attributes) {
    if (t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name, { name: 'style' })) {
      if (
        attribute.value &&
        t.isJSXExpressionContainer(attribute.value) &&
        !t.isJSXEmptyExpression(attribute.value.expression)
      ) {
        return {
          styleAttribute: attribute,
          styleExpr: attribute.value.expression,
        };
      }
      return { styleAttribute: attribute };
    }
  }
  return {};
}

/**
 * Processes style and accessibility attributes, replacing them with optimized versions.
 */
function processProps(
  path: NodePath<t.JSXOpeningElement>,
  file: HubFile,
  originalAttributes: Array<t.JSXAttribute | t.JSXSpreadAttribute>
) {
  const { styleExpr } = extractStyleAttribute(originalAttributes);
  const hasA11y = hasAccessibilityProperty(path, originalAttributes);

  if (styleExpr && hasA11y) {
    // When both style and accessibility properties exist, we split them into two separate spread attributes
    const accessibilityAttributes = originalAttributes.filter(
      (attribute) => !(t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name, { name: 'style' }))
    );

    // Set up the accessibility import
    const normalizeIdentifier = addFileImportHint({
      file,
      nameHint: 'normalizeAccessibilityProps',
      path,
      importName: 'normalizeAccessibilityProps',
      moduleName: 'react-native-boost',
    });
    const accessibilityObject = buildPropertiesFromAttributes(accessibilityAttributes);
    const accessibilityExpr = t.callExpression(t.identifier(normalizeIdentifier.name), [accessibilityObject]);

    // Set up the style import
    const flattenIdentifier = addFileImportHint({
      file,
      nameHint: 'flattenTextStyle',
      path,
      importName: 'flattenTextStyle',
      moduleName: 'react-native-boost',
    });
    const flattenedStyleExpr = t.callExpression(t.identifier(flattenIdentifier.name), [styleExpr]);

    // Use two separate JSX spread attributes
    path.node.attributes = [t.jsxSpreadAttribute(accessibilityExpr), t.jsxSpreadAttribute(flattenedStyleExpr)];
  } else if (styleExpr) {
    // Only style attribute is present
    const flattenIdentifier = addFileImportHint({
      file,
      nameHint: 'flattenTextStyle',
      path,
      importName: 'flattenTextStyle',
      moduleName: 'react-native-boost',
    });
    const flattened = t.callExpression(t.identifier(flattenIdentifier.name), [styleExpr]);
    path.node.attributes = [t.jsxSpreadAttribute(flattened)];
  } else if (hasA11y) {
    // Only accessibility properties are present
    const normalizeIdentifier = addFileImportHint({
      file,
      nameHint: 'normalizeAccessibilityProps',
      path,
      importName: 'normalizeAccessibilityProps',
      moduleName: 'react-native-boost',
    });
    const propsObject = buildPropertiesFromAttributes(originalAttributes);
    const normalized = t.callExpression(t.identifier(normalizeIdentifier.name), [propsObject]);
    path.node.attributes = [t.jsxSpreadAttribute(normalized)];
  }
}
