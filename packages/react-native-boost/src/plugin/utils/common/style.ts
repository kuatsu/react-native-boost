import { types as t } from '@babel/core';
import { USER_SELECT_STYLE_TO_SELECTABLE_PROP } from '../constants';

/**
 * Extracts the `style` attribute from a JSX attributes list.
 *
 * @returns An object containing the attribute node itself (if found) and the expression inside
 */
export function extractStyleAttribute(attributes: Array<t.JSXAttribute | t.JSXSpreadAttribute>): {
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
 * Attempts to statically extract the `userSelect` style property from a style expression.
 *
 * If the `userSelect` value can be resolved at compile-time, the property is removed from the
 * object literal (or array element) and its mapped boolean value for the native `selectable`
 * prop is returned. When the value is unknown or the expression is not statically analysable,
 * `undefined` is returned and no modification is made.
 */
export function extractSelectableAndUpdateStyle(styleExpr: t.Expression): boolean | undefined {
  // Helper to process a single ObjectExpression
  const handleObjectExpression = (objectExpr: t.ObjectExpression): boolean | undefined => {
    let selectableValue: boolean | undefined;

    objectExpr.properties = objectExpr.properties.filter((property) => {
      if (
        !t.isObjectProperty(property) ||
        (!t.isIdentifier(property.key, { name: 'userSelect' }) &&
          !(t.isStringLiteral(property.key) && property.key.value === 'userSelect'))
      ) {
        return true; // keep property
      }

      if (t.isStringLiteral(property.value)) {
        const mapped = USER_SELECT_STYLE_TO_SELECTABLE_PROP[property.value.value];
        if (mapped !== undefined) {
          selectableValue = mapped;
        }
      }

      // Remove the `userSelect` property
      return false;
    });

    return selectableValue;
  };

  if (t.isObjectExpression(styleExpr)) {
    return handleObjectExpression(styleExpr);
  }

  if (t.isArrayExpression(styleExpr)) {
    let selectableValue: boolean | undefined;
    for (const element of styleExpr.elements) {
      if (element && t.isObjectExpression(element)) {
        const value = handleObjectExpression(element);
        if (value !== undefined) {
          selectableValue = value; // prefer last defined value (runtime precedence)
        }
      }
    }
    return selectableValue;
  }

  return undefined; // not statically analysable
}
