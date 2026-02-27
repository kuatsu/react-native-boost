import { NodePath, types as t } from '@babel/core';
import { ensureArray } from '../helpers';
import { HubFile } from '../../types';
import { minimatch } from 'minimatch';
import nodePath from 'node:path';
import PluginError from '../plugin-error';

/**
 * Checks if the file is in the list of ignored files.
 *
 * @param path - The path to the JSXOpeningElement.
 * @param ignores - List of glob paths (absolute or relative to import.meta.dirname).
 * @returns true if the file matches any of the ignore patterns.
 */
export const isIgnoredFile = (path: NodePath<t.JSXOpeningElement>, ignores: string[]): boolean => {
  const hub = path.hub as unknown;
  const file = typeof hub === 'object' && hub !== null && 'file' in hub ? (hub.file as HubFile) : undefined;

  if (!file) {
    throw new PluginError('No file found in Babel hub');
  }

  const fileName = file.opts.filename;

  // Use the current working directory which typically corresponds to the user's project root.
  const baseDirectory = 'cwd' in file.opts ? (file.opts.cwd as string) : process.cwd();

  // Iterate through the ignore patterns.
  for (const pattern of ignores) {
    // If the pattern is not absolute, join it with the baseDir
    const absolutePattern = nodePath.isAbsolute(pattern) ? pattern : nodePath.join(baseDirectory, pattern);

    // Check if the file name matches the glob pattern.
    if (minimatch(fileName, absolutePattern, { dot: true })) {
      return true;
    }
  }

  return false;
};

/**
 * Checks if the JSX element should be ignored based on a preceding comment.
 *
 * The function looks up the JSXOpeningElement's own leading comments as well as
 * the parent element's comments before falling back to inspect siblings.
 *
 * @param path - The path to the JSXOpeningElement.
 * @returns true if the JSX element should be ignored.
 */
export const isIgnoredLine = (path: NodePath<t.JSXOpeningElement>): boolean => {
  // Check for @boost-ignore in the leading comments on the JSX opening element.
  if (path.node.leadingComments?.some((comment) => comment.value.includes('@boost-ignore'))) {
    return true;
  }

  // Check for @boost-ignore in the leading comments on the parent JSX element.
  const jsxElementPath = path.parentPath;
  if (jsxElementPath.node.leadingComments?.some((comment) => comment.value.includes('@boost-ignore'))) {
    return true;
  }

  // NEW: Check for @boost-ignore in the leading comments on the ObjectProperty (if it exists)
  // This handles cases where the JSX element is used as a value inside an object literal.
  const propertyPath = jsxElementPath.parentPath;
  if (
    propertyPath &&
    propertyPath.isObjectProperty() &&
    propertyPath.node.leadingComments?.some((comment) => comment.value.includes('@boost-ignore'))
  ) {
    return true;
  }

  if (!jsxElementPath.parentPath) return false;

  // Get the container that holds this element (for example, a JSX fragment or JSX element)
  const containerPath = jsxElementPath.parentPath;
  const siblings = ensureArray(containerPath.get('children'));
  const index = siblings.findIndex((sibling) => sibling.node === jsxElementPath.node);
  if (index === -1) return false;

  // Look backward from the current element for a non-empty node.
  for (let index_ = index - 1; index_ >= 0; index_--) {
    const sibling = siblings[index_];
    // Skip over any whitespace (only in JSXText nodes)
    if (sibling.isJSXText() && sibling.node.value.trim() === '') {
      continue;
    }
    // If the sibling is a JSX expression container, check its empty expression's comments.
    if (sibling.isJSXExpressionContainer()) {
      const expression = sibling.get('expression');
      if (expression && expression.node) {
        const comments = [
          ...(expression.node.leadingComments || []),
          ...(expression.node.trailingComments || []),
          ...(expression.node.innerComments || []),
        ].map((comment) => comment.value.trim());
        if (comments.some((comment) => comment.includes('@boost-ignore'))) {
          return true;
        }
      }
    }
    // Also check if the node itself carries a leadingComments property.
    if (
      sibling.node.leadingComments &&
      sibling.node.leadingComments.some((comment) => comment.value.includes('@boost-ignore'))
    ) {
      return true;
    }
    break; // if the immediate non-whitespace node is not our ignore marker, stop
  }
  return false;
};

/**
 * Checks if the path represents a valid JSX component with the specified name.
 *
 * @param path - The NodePath to check.
 * @param componentName - The name of the component to validate against.
 * @returns true if the path is a valid JSX component with the specified name.
 */
export const isValidJSXComponent = (path: NodePath<t.JSXOpeningElement>, componentName: string): boolean => {
  // Check if the node name is a JSX identifier
  if (!t.isJSXIdentifier(path.node.name)) return false;

  // Check if the parent is a JSX element
  const parent = path.parent;
  if (!t.isJSXElement(parent)) return false;

  // For aliasing, we check if the underlying imported name matches the expected name
  const componentIdentifier = path.node.name.name;
  const binding = path.scope.getBinding(componentIdentifier);
  if (!binding) return false;
  if (
    binding.kind === 'module' &&
    t.isImportDeclaration(binding.path.parent) &&
    t.isImportSpecifier(binding.path.node)
  ) {
    const imported = binding.path.node.imported;
    if (t.isIdentifier(imported)) {
      return imported.name === componentName;
    }
  }

  // Fallback to string match if binding is not available
  return path.node.name.name === componentName;
};

/**
 * Checks if the component is imported from 'react-native' and not from a custom module.
 *
 * @param path - The NodePath to check.
 * @param expectedImportedName - The expected import name of the component (we'll also check for aliased imports).
 * @returns true if the component is imported from 'react-native'
 */
export const isReactNativeImport = (path: NodePath<t.JSXOpeningElement>, expectedImportedName: string): boolean => {
  if (!t.isJSXIdentifier(path.node.name)) return false;
  const localName = path.node.name.name;
  const binding = path.scope.getBinding(localName);
  if (!binding) return false;
  if (binding.kind === 'module') {
    const importDeclaration = binding.path.parent;
    if (!t.isImportDeclaration(importDeclaration)) return false;
    // Verify it's imported from 'react-native'
    if (importDeclaration.source.value !== 'react-native') return false;

    // For named imports, check the imported name (not the alias)
    if (t.isImportSpecifier(binding.path.node)) {
      const imported = binding.path.node.imported;
      if (t.isIdentifier(imported)) {
        return imported.name === expectedImportedName;
      }
    }

    // For default imports, we just assume it's valid if imported from react-native.
    if (t.isImportDefaultSpecifier(binding.path.node)) {
      return true;
    }
  }
  return false;
};

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

/**
 * Checks whether the closest JSX element ancestor is expo-router Link with a truthy asChild prop.
 *
 * We only bail on Text optimization when Link is effectively slotting that Text as the clickable child.
 */
export const hasExpoRouterLinkParentWithAsChild = (path: NodePath<t.JSXOpeningElement>): boolean => {
  const textElementPath = path.parentPath;
  if (!textElementPath.isJSXElement()) return false;

  let ancestorPath: NodePath<t.Node> | null = textElementPath.parentPath;

  while (ancestorPath) {
    if (ancestorPath.isJSXElement()) {
      if (!isExpoRouterLinkElement(ancestorPath)) return false;

      return hasTruthyAsChildAttribute(ancestorPath.node.openingElement.attributes);
    }

    ancestorPath = ancestorPath.parentPath;
  }

  return false;
};

function isExpoRouterLinkElement(path: NodePath<t.JSXElement>): boolean {
  const openingElementName = path.node.openingElement.name;

  if (t.isJSXIdentifier(openingElementName)) {
    const binding = path.scope.getBinding(openingElementName.name);
    if (!binding || binding.kind !== 'module') return false;
    if (!t.isImportSpecifier(binding.path.node)) return false;

    const importDeclaration = binding.path.parent;
    if (!t.isImportDeclaration(importDeclaration) || importDeclaration.source.value !== 'expo-router') return false;

    const imported = binding.path.node.imported;
    return t.isIdentifier(imported, { name: 'Link' }) || (t.isStringLiteral(imported) && imported.value === 'Link');
  }

  if (t.isJSXMemberExpression(openingElementName)) {
    if (!t.isJSXIdentifier(openingElementName.object)) return false;
    if (!t.isJSXIdentifier(openingElementName.property, { name: 'Link' })) return false;

    const namespaceBinding = path.scope.getBinding(openingElementName.object.name);
    if (!namespaceBinding || namespaceBinding.kind !== 'module') return false;
    if (!t.isImportNamespaceSpecifier(namespaceBinding.path.node)) return false;

    const importDeclaration = namespaceBinding.path.parent;
    return t.isImportDeclaration(importDeclaration) && importDeclaration.source.value === 'expo-router';
  }

  return false;
}

function hasTruthyAsChildAttribute(attributes: (t.JSXAttribute | t.JSXSpreadAttribute)[]): boolean {
  let asChildAttribute: t.JSXAttribute | undefined;

  for (const attribute of attributes) {
    if (t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name, { name: 'asChild' })) {
      asChildAttribute = attribute;
    }
  }

  if (!asChildAttribute) return false;

  return isJSXAttributeValueTruthy(asChildAttribute.value);
}

function isJSXAttributeValueTruthy(value: t.JSXAttribute['value']): boolean {
  if (!value) return true;
  if (t.isStringLiteral(value)) return value.value.length > 0;
  if (t.isJSXElement(value) || t.isJSXFragment(value)) return true;

  if (t.isJSXExpressionContainer(value)) {
    const staticTruthiness = getStaticExpressionTruthiness(value.expression);
    return staticTruthiness ?? true;
  }

  return true;
}

function getStaticExpressionTruthiness(expression: t.Expression | t.JSXEmptyExpression): boolean | undefined {
  if (t.isJSXEmptyExpression(expression)) return false;
  if (t.isBooleanLiteral(expression)) return expression.value;
  if (t.isNullLiteral(expression)) return false;
  if (t.isStringLiteral(expression)) return expression.value.length > 0;
  if (t.isNumericLiteral(expression)) return expression.value !== 0 && !Number.isNaN(expression.value);
  if (t.isBigIntLiteral(expression)) return expression.value !== '0';
  if (t.isIdentifier(expression, { name: 'undefined' })) return false;

  if (t.isTemplateLiteral(expression) && expression.expressions.length === 0) {
    return (expression.quasis[0]?.value.cooked ?? '').length > 0;
  }

  if (t.isUnaryExpression(expression, { operator: '!' })) {
    const staticTruthiness = getStaticExpressionTruthiness(expression.argument);
    return staticTruthiness === undefined ? undefined : !staticTruthiness;
  }

  return undefined;
}
