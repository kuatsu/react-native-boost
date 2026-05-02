import { NodePath, types as t } from '@babel/core';
import { ACCESSIBILITY_PROPERTIES } from '../constants';
import { USER_SELECT_STYLE_TO_SELECTABLE_PROP } from '../constants';

const UNISTYLES_MODULE_NAME = 'react-native-unistyles';

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

export type UnistylesStyleStatus = 'none' | 'static' | 'dynamic';

/**
 * Checks whether the JSX element receives a style that comes from Unistyles'
 * StyleSheet.create output.
 */
export const hasUnistylesStyleProperty = (path: NodePath<t.JSXOpeningElement>): boolean => {
  return getUnistylesStyleStatus(path) !== 'none';
};

/**
 * Returns whether Unistyles styles used by this JSX element are provably static.
 * Any runtime syntax in the StyleSheet.create call or style expression is treated
 * as dynamic so the optimizer can leave the component unchanged.
 */
export const getUnistylesStyleStatus = (path: NodePath<t.JSXOpeningElement>): UnistylesStyleStatus => {
  let status: UnistylesStyleStatus = 'none';

  for (const attribute of path.node.attributes) {
    if (t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name, { name: 'style' })) {
      const styleExpression = getJSXAttributeExpression(attribute);
      status = mergeUnistylesStyleStatus(
        status,
        styleExpression ? getExpressionUnistylesStyleStatus(path, styleExpression) : 'none'
      );
    }

    if (t.isJSXSpreadAttribute(attribute)) {
      const objectExpression = resolveObjectExpression(path, attribute.argument);
      if (!objectExpression) continue;

      for (const property of objectExpression.properties) {
        if (!t.isObjectProperty(property) || property.computed || !isStaticPropertyName(property.key, 'style')) {
          continue;
        }

        status = mergeUnistylesStyleStatus(
          status,
          t.isExpression(property.value) ? getExpressionUnistylesStyleStatus(path, property.value) : 'none'
        );
      }
    }

    if (status === 'dynamic') return status;
  }

  return status;
};

function mergeUnistylesStyleStatus(current: UnistylesStyleStatus, next: UnistylesStyleStatus): UnistylesStyleStatus {
  if (current === 'dynamic' || next === 'dynamic') return 'dynamic';
  if (current === 'static' || next === 'static') return 'static';
  return 'none';
}

function getJSXAttributeExpression(attribute: t.JSXAttribute): t.Expression | undefined {
  if (!attribute.value || !t.isJSXExpressionContainer(attribute.value)) return undefined;
  if (t.isJSXEmptyExpression(attribute.value.expression)) return undefined;

  return attribute.value.expression;
}

function resolveObjectExpression(
  path: NodePath<t.JSXOpeningElement>,
  expression: t.Expression
): t.ObjectExpression | undefined {
  if (t.isObjectExpression(expression)) return expression;

  if (t.isIdentifier(expression)) {
    const binding = path.scope.getBinding(expression.name);
    if (
      binding?.path.node &&
      t.isVariableDeclarator(binding.path.node) &&
      t.isObjectExpression(binding.path.node.init)
    ) {
      return binding.path.node.init;
    }
  }

  return undefined;
}

function getExpressionUnistylesStyleStatus(
  path: NodePath<t.JSXOpeningElement>,
  expression: t.Expression,
  seen = new WeakSet<t.Node>()
): UnistylesStyleStatus {
  if (seen.has(expression)) return 'none';
  seen.add(expression);

  if (t.isIdentifier(expression)) {
    if (isUnistylesStyleSheetBinding(path, expression.name)) return 'dynamic';

    const binding = path.scope.getBinding(expression.name);
    if (!binding?.path.node || !t.isVariableDeclarator(binding.path.node)) return 'none';
    if (!binding.path.node.init || !t.isExpression(binding.path.node.init)) return 'none';

    return getExpressionUnistylesStyleStatus(path, binding.path.node.init, seen);
  }

  if (t.isMemberExpression(expression)) {
    const memberStatus = getUnistylesStyleMemberStatus(path, expression);
    if (memberStatus !== 'none') return memberStatus;

    let status: UnistylesStyleStatus = 'none';
    if (t.isExpression(expression.object)) {
      status = mergeUnistylesStyleStatus(status, getExpressionUnistylesStyleStatus(path, expression.object, seen));
    }
    if (expression.computed && t.isExpression(expression.property)) {
      status = mergeUnistylesStyleStatus(status, getExpressionUnistylesStyleStatus(path, expression.property, seen));
    }

    return status;
  }

  if (t.isArrayExpression(expression)) {
    let status: UnistylesStyleStatus = 'none';

    for (const element of expression.elements) {
      if (!element) continue;
      if (t.isSpreadElement(element)) {
        return getExpressionUnistylesStyleStatus(path, element.argument, seen) === 'none' ? status : 'dynamic';
      }
      if (t.isExpression(element)) {
        status = mergeUnistylesStyleStatus(status, getExpressionUnistylesStyleStatus(path, element, seen));
      }
      if (status === 'dynamic') return status;
    }

    return status;
  }

  if (t.isConditionalExpression(expression)) {
    return mergeUnistylesStyleStatus(
      getExpressionUnistylesStyleStatus(path, expression.test, seen),
      mergeUnistylesStyleStatus(
        getExpressionUnistylesStyleStatus(path, expression.consequent, seen),
        getExpressionUnistylesStyleStatus(path, expression.alternate, seen)
      )
    ) === 'none'
      ? 'none'
      : 'dynamic';
  }

  if (t.isLogicalExpression(expression) || t.isBinaryExpression(expression)) {
    const status = mergeUnistylesStyleStatus(
      t.isExpression(expression.left) ? getExpressionUnistylesStyleStatus(path, expression.left, seen) : 'none',
      t.isExpression(expression.right) ? getExpressionUnistylesStyleStatus(path, expression.right, seen) : 'none'
    );

    return status === 'none' ? 'none' : 'dynamic';
  }

  if (t.isSequenceExpression(expression)) {
    let status: UnistylesStyleStatus = 'none';

    for (const item of expression.expressions) {
      status = mergeUnistylesStyleStatus(status, getExpressionUnistylesStyleStatus(path, item, seen));
      if (status === 'dynamic') return status;
    }

    return status;
  }

  if (t.isCallExpression(expression)) {
    let status: UnistylesStyleStatus = t.isExpression(expression.callee)
      ? getExpressionUnistylesStyleStatus(path, expression.callee, seen)
      : 'none';

    for (const argument of expression.arguments) {
      if (!t.isExpression(argument)) continue;
      status = mergeUnistylesStyleStatus(status, getExpressionUnistylesStyleStatus(path, argument, seen));
      if (status !== 'none') return 'dynamic';
    }

    return status === 'none' ? 'none' : 'dynamic';
  }

  if (t.isUnaryExpression(expression)) {
    return getExpressionUnistylesStyleStatus(path, expression.argument, seen);
  }

  if (t.isTSAsExpression(expression) || t.isTSSatisfiesExpression(expression) || t.isTSNonNullExpression(expression)) {
    return getExpressionUnistylesStyleStatus(path, expression.expression, seen);
  }

  if (t.isTypeCastExpression(expression)) {
    return getExpressionUnistylesStyleStatus(path, expression.expression, seen);
  }

  return 'none';
}

function getUnistylesStyleMemberStatus(
  path: NodePath<t.JSXOpeningElement>,
  expression: t.MemberExpression
): UnistylesStyleStatus {
  if (!t.isIdentifier(expression.object)) return 'none';

  const styleSheetCreateCall = getUnistylesStyleSheetCreateCallForBinding(path, expression.object.name);
  if (!styleSheetCreateCall) return 'none';

  const styleName = getStaticMemberName(expression);
  if (!styleName) return 'dynamic';

  const createArgument = styleSheetCreateCall.arguments[0];
  if (!t.isObjectExpression(createArgument)) return 'dynamic';

  const styleProperty = findObjectProperty(createArgument, styleName);
  if (!styleProperty || !t.isObjectProperty(styleProperty)) return 'dynamic';

  return isStaticUnistylesStyleValue(styleProperty.value) ? 'static' : 'dynamic';
}

function getStaticMemberName(expression: t.MemberExpression): string | undefined {
  if (!expression.computed && t.isIdentifier(expression.property)) return expression.property.name;
  if (expression.computed && t.isStringLiteral(expression.property)) return expression.property.value;
  return undefined;
}

function findObjectProperty(objectExpression: t.ObjectExpression, name: string): t.ObjectProperty | undefined {
  return objectExpression.properties.find((property): property is t.ObjectProperty => {
    return t.isObjectProperty(property) && !property.computed && isStaticPropertyName(property.key, name);
  });
}

function isStaticUnistylesStyleValue(node: t.Node): boolean {
  if (t.isStringLiteral(node) || t.isNumericLiteral(node) || t.isBooleanLiteral(node) || t.isNullLiteral(node)) {
    return true;
  }

  if (t.isUnaryExpression(node)) {
    return ['-', '+'].includes(node.operator) && t.isNumericLiteral(node.argument);
  }

  if (t.isArrayExpression(node)) {
    return node.elements.every(
      (element) => element != null && t.isExpression(element) && isStaticUnistylesStyleValue(element)
    );
  }

  if (t.isObjectExpression(node)) {
    return node.properties.every((property) => {
      return (
        t.isObjectProperty(property) &&
        !property.computed &&
        isStaticObjectKey(property.key) &&
        isStaticUnistylesStyleValue(property.value)
      );
    });
  }

  if (t.isTSAsExpression(node) || t.isTSSatisfiesExpression(node) || t.isTSNonNullExpression(node)) {
    return isStaticUnistylesStyleValue(node.expression);
  }

  if (t.isTypeCastExpression(node)) {
    return isStaticUnistylesStyleValue(node.expression);
  }

  return false;
}

function isStaticObjectKey(key: t.ObjectProperty['key']): boolean {
  return t.isIdentifier(key) || t.isStringLiteral(key) || t.isNumericLiteral(key);
}

function isUnistylesStyleSheetBinding(path: NodePath<t.JSXOpeningElement>, name: string): boolean {
  return getUnistylesStyleSheetCreateCallForBinding(path, name) !== undefined;
}

function getUnistylesStyleSheetCreateCallForBinding(
  path: NodePath<t.JSXOpeningElement>,
  name: string
): t.CallExpression | undefined {
  const binding = path.scope.getBinding(name);
  if (!binding?.path.node || !t.isVariableDeclarator(binding.path.node)) return undefined;

  const initializer = binding.path.node.init;
  if (!t.isCallExpression(initializer)) return undefined;
  if (!isUnistylesStyleSheetCreateCall(path, initializer)) return undefined;

  return initializer;
}

function isUnistylesStyleSheetCreateCall(path: NodePath<t.JSXOpeningElement>, expression: t.CallExpression): boolean {
  const { callee } = expression;
  if (!t.isMemberExpression(callee)) return false;
  if (!t.isIdentifier(callee.property, { name: 'create' }) || callee.computed) return false;

  if (t.isIdentifier(callee.object)) {
    return isUnistylesStyleSheetImport(path, callee.object.name);
  }

  if (
    t.isMemberExpression(callee.object) &&
    t.isIdentifier(callee.object.object) &&
    t.isIdentifier(callee.object.property, { name: 'StyleSheet' }) &&
    !callee.object.computed
  ) {
    return isUnistylesNamespaceImport(path, callee.object.object.name);
  }

  return false;
}
function isUnistylesStyleSheetImport(path: NodePath<t.JSXOpeningElement>, name: string): boolean {
  const binding = path.scope.getBinding(name);
  if (!binding || binding.kind !== 'module') return false;
  if (!t.isImportSpecifier(binding.path.node)) return false;

  const importDeclaration = binding.path.parent;
  if (!t.isImportDeclaration(importDeclaration) || importDeclaration.source.value !== UNISTYLES_MODULE_NAME) {
    return false;
  }

  const imported = binding.path.node.imported;
  return (
    t.isIdentifier(imported, { name: 'StyleSheet' }) || (t.isStringLiteral(imported) && imported.value === 'StyleSheet')
  );
}

function isUnistylesNamespaceImport(path: NodePath<t.JSXOpeningElement>, name: string): boolean {
  const binding = path.scope.getBinding(name);
  if (!binding || binding.kind !== 'module') return false;
  if (!t.isImportNamespaceSpecifier(binding.path.node)) return false;

  const importDeclaration = binding.path.parent;
  return t.isImportDeclaration(importDeclaration) && importDeclaration.source.value === UNISTYLES_MODULE_NAME;
}

function isStaticPropertyName(key: t.ObjectProperty['key'], name: string): boolean {
  return t.isIdentifier(key, { name }) || (t.isStringLiteral(key) && key.value === name);
}

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
          selectableValue = value; // prefer last defined value
        }
      }
    }
    return selectableValue;
  }

  return undefined; // not statically analysable
}

/**
 * Checks if a node represents a string value.
 */
export const isStringNode = (path: NodePath<t.JSXOpeningElement>, child: t.Node): boolean => {
  if (t.isJSXText(child) || t.isStringLiteral(child)) return true;

  if (t.isJSXExpressionContainer(child)) {
    const expression = child.expression;
    if (t.isIdentifier(expression)) {
      const binding = path.scope.getBinding(expression.name);
      if (binding && binding.path.node && t.isVariableDeclarator(binding.path.node)) {
        return !!binding.path.node.init && t.isStringLiteral(binding.path.node.init);
      }
      return false;
    }
    if (t.isStringLiteral(expression)) return true;
  }
  return false;
};
