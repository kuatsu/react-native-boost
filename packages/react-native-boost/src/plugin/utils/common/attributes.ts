import { NodePath, types as t } from '@babel/core';
import { ACCESSIBILITY_PROPERTIES } from '../constants';

/**
 * Checks if the JSX element has a blacklisted property.
 *
 * @param path - The path to the JSXOpeningElement.
 * @param blacklist - The set of blacklisted properties.
 * @returns true if the JSX element has a blacklisted property.
 */
export const hasBlacklistedProperty = (path: NodePath<t.JSXOpeningElement>, blacklist: Set<string>): boolean => {
  return path.node.attributes.some((attribute) => {
    // Check direct attributes (e.g., onPress={handler})
    if (t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name) && blacklist.has(attribute.name.name)) {
      return true;
    }

    // Check spread attributes (e.g., {...props})
    if (t.isJSXSpreadAttribute(attribute)) {
      if (t.isIdentifier(attribute.argument)) {
        const binding = path.scope.getBinding(attribute.argument.name);
        let objectExpression: t.ObjectExpression | undefined;
        if (binding) {
          // If the binding node is a VariableDeclarator, use its initializer
          if (t.isVariableDeclarator(binding.path.node)) {
            objectExpression = binding.path.node.init as t.ObjectExpression;
          } else if (t.isObjectExpression(binding.path.node)) {
            objectExpression = binding.path.node;
          }
        }
        if (objectExpression && t.isObjectExpression(objectExpression)) {
          return objectExpression.properties.some((property) => {
            if (t.isObjectProperty(property) && t.isIdentifier(property.key)) {
              return blacklist.has(property.key.name);
            }
            return false;
          });
        }
      }
      // Bail if we can't resolve the spread attribute
      return true;
    }

    // For other attribute types, assume no blacklisting
    return false;
  });
};

/**
 * Adds a default property to a JSX element if it's not already defined. It avoids adding a default
 * if it cannot statically determine whether the property is already set.
 *
 * @param path - The path to the JSXOpeningElement.
 * @param key - The property key.
 * @param value - The default value expression.
 */
export const addDefaultProperty = (path: NodePath<t.JSXOpeningElement>, key: string, value: t.Expression) => {
  let propertyIsFound = false;
  let hasUnresolvableSpread = false;

  for (const attribute of path.node.attributes) {
    if (t.isJSXAttribute(attribute) && attribute.name.name === key) {
      propertyIsFound = true;
      break;
    }

    if (t.isJSXSpreadAttribute(attribute)) {
      if (t.isObjectExpression(attribute.argument)) {
        const propertyInSpread = attribute.argument.properties.some(
          (p) =>
            (t.isObjectProperty(p) && t.isIdentifier(p.key) && p.key.name === key) ||
            (t.isObjectProperty(p) && t.isStringLiteral(p.key) && p.key.value === key)
        );
        if (propertyInSpread) {
          propertyIsFound = true;
          break;
        }
      } else if (t.isIdentifier(attribute.argument)) {
        const binding = path.scope.getBinding(attribute.argument.name);
        if (
          binding?.path.node &&
          t.isVariableDeclarator(binding.path.node) &&
          t.isObjectExpression(binding.path.node.init)
        ) {
          const propertyInSpread = binding.path.node.init.properties.some(
            (p) =>
              (t.isObjectProperty(p) && t.isIdentifier(p.key) && p.key.name === key) ||
              (t.isObjectProperty(p) && t.isStringLiteral(p.key) && p.key.value === key)
          );
          if (propertyInSpread) {
            propertyIsFound = true;
            break;
          }
        } else {
          hasUnresolvableSpread = true;
          break;
        }
      } else {
        hasUnresolvableSpread = true;
        break;
      }
    }
  }

  if (!propertyIsFound && !hasUnresolvableSpread) {
    path.node.attributes.push(t.jsxAttribute(t.jsxIdentifier(key), t.jsxExpressionContainer(value)));
  }
};

/**
 * Helper that builds an Object.assign expression out of the existing JSX attributes.
 * It handles both plain JSXAttributes and spread attributes.
 *
 * @param attributes - The attributes to build the expression from.
 * @returns The Object.assign expression.
 */
export const buildPropertiesFromAttributes = (attributes: (t.JSXAttribute | t.JSXSpreadAttribute)[]): t.Expression => {
  const arguments_: t.Expression[] = [];
  for (const attribute of attributes) {
    if (t.isJSXSpreadAttribute(attribute)) {
      arguments_.push(attribute.argument);
    } else if (t.isJSXAttribute(attribute)) {
      const key = attribute.name.name;
      let value: t.Expression;
      if (!attribute.value) {
        value = t.booleanLiteral(true);
      } else if (t.isStringLiteral(attribute.value)) {
        value = attribute.value;
      } else if (t.isJSXExpressionContainer(attribute.value)) {
        value = t.isJSXEmptyExpression(attribute.value.expression)
          ? t.booleanLiteral(true)
          : attribute.value.expression;
      } else {
        value = t.nullLiteral();
      }
      // If the key is not a valid JavaScript identifier (e.g. "aria-label"), use a string literal.
      const validIdentifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
      const keyNode =
        typeof key === 'string' && validIdentifierRegex.test(key) ? t.identifier(key) : t.stringLiteral(key.toString());

      arguments_.push(t.objectExpression([t.objectProperty(keyNode, value)]));
    }
  }
  if (arguments_.length === 0) {
    return t.objectExpression([]);
  }
  return t.callExpression(t.memberExpression(t.identifier('Object'), t.identifier('assign')), [
    t.objectExpression([]),
    ...arguments_,
  ]);
};

/**
 * Checks if the JSX element has an accessibility property.
 *
 * @param path - The NodePath for the JSXOpeningElement, used for scope lookup.
 * @param attributes - The attributes to check.
 * @returns true if the JSX element has an accessibility property.
 */
export const hasAccessibilityProperty = (
  path: NodePath<t.JSXOpeningElement>,
  attributes: (t.JSXAttribute | t.JSXSpreadAttribute)[]
): boolean => {
  for (const attribute of attributes) {
    if (t.isJSXAttribute(attribute)) {
      const key = attribute.name.name;
      if (typeof key === 'string' && ACCESSIBILITY_PROPERTIES.has(key)) {
        return true;
      }
    } else if (t.isJSXSpreadAttribute(attribute)) {
      if (t.isObjectExpression(attribute.argument)) {
        for (const property of attribute.argument.properties) {
          if (
            t.isObjectProperty(property) &&
            t.isIdentifier(property.key) &&
            ACCESSIBILITY_PROPERTIES.has(property.key.name)
          ) {
            return true;
          }
        }
      } else if (t.isIdentifier(attribute.argument)) {
        const binding = path.scope.getBinding(attribute.argument.name);
        if (binding && t.isVariableDeclarator(binding.path.node)) {
          const declarator = binding.path.node as t.VariableDeclarator;
          if (declarator.init && t.isObjectExpression(declarator.init)) {
            for (const property of declarator.init.properties) {
              if (
                t.isObjectProperty(property) &&
                t.isIdentifier(property.key) &&
                ACCESSIBILITY_PROPERTIES.has(property.key.name)
              ) {
                return true;
              }
            }
            continue;
          }
        }
        return true;
      } else {
        return true;
      }
    }
  }
  return false;
};
