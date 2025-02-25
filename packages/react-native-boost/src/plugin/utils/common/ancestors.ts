import { NodePath, types as t } from '@babel/core';

/**
 * Checks if any ancestor element is of the specified component type or contains that component type.
 * This function handles both direct ancestors and custom components that may contain the specified component.
 *
 * @param path - The path to the JSXOpeningElement.
 * @param componentName - The name of the component to check for in ancestors.
 * @param skipComponents - Optional array of component names to skip when checking ancestors.
 * @returns true if any ancestor is or contains the specified component.
 */
export function hasComponentAncestor(
  path: NodePath<t.JSXOpeningElement>,
  componentName: string,
  skipComponents: string[] = ['Fragment']
): boolean {
  // Check for direct ancestors of the specified component type
  const directAncestor = path.findParent((parentPath) => {
    return (
      t.isJSXElement(parentPath.node) && t.isJSXIdentifier(parentPath.node.openingElement.name, { name: componentName })
    );
  });

  if (directAncestor) return true;

  // Check for indirect ancestors (custom components that contain the specified component)
  return !!path.findParent((parentPath) => {
    // Only check JSX elements
    if (!t.isJSXElement(parentPath.node)) return false;

    // Get the component name
    const openingElement = parentPath.node.openingElement;
    if (!t.isJSXIdentifier(openingElement.name)) return false;

    const ancestorComponentName = openingElement.name.name;

    // Skip the component we're looking for
    if (ancestorComponentName === componentName) {
      return false;
    }

    // Skip components in the skipComponents list
    if (skipComponents.includes(ancestorComponentName)) {
      return false;
    }

    // Skip lowercase components (built-in HTML elements)
    if (ancestorComponentName[0] === ancestorComponentName[0].toLowerCase()) {
      return false;
    }

    // Try to find the component definition through variable binding
    const binding = parentPath.scope.getBinding(ancestorComponentName);
    if (!binding) return false;

    // Now check the component definition for the specified component
    if (t.isVariableDeclarator(binding.path.node)) {
      const init = binding.path.node.init;

      // Handle arrow functions or function expressions
      if (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) {
        // Check the function body for the specified component
        return t.isBlockStatement(init.body)
          ? hasComponentInReturnStatement(init.body, componentName)
          : hasComponentInExpression(init.body, componentName);
      }
    } else if (t.isFunctionDeclaration(binding.path.node)) {
      // Handle function declarations
      return hasComponentInReturnStatement(binding.path.node.body, componentName);
    }

    return false;
  });
}

/**
 * Check if a block statement contains a return statement with the specified component
 *
 * @param blockStatement - The block statement to check
 * @param componentName - The name of the component to look for
 * @returns true if the block statement contains a return with the specified component
 */
function hasComponentInReturnStatement(blockStatement: t.BlockStatement, componentName: string): boolean {
  for (const statement of blockStatement.body) {
    if (
      t.isReturnStatement(statement) &&
      statement.argument &&
      hasComponentInExpression(statement.argument, componentName)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Check if an expression contains the specified component
 *
 * @param expression - The expression to check
 * @param componentName - The name of the component to look for
 * @returns true if the expression contains the specified component
 */
function hasComponentInExpression(expression: t.Expression, componentName: string): boolean {
  // If directly returning a JSX element
  if (t.isJSXElement(expression)) {
    // Check if it's the specified component
    if (t.isJSXIdentifier(expression.openingElement.name, { name: componentName })) {
      return true;
    }

    // Check if any children are the specified component
    for (const child of expression.children) {
      if (t.isJSXElement(child) && t.isJSXIdentifier(child.openingElement.name, { name: componentName })) {
        return true;
      }
    }
  }

  return false;
}
