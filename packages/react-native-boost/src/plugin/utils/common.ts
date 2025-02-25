import { NodePath, types as t } from '@babel/core';
import { ensureArray } from './helpers';
import { FileImportOptions, HubFile } from '../types';
import { minimatch } from 'minimatch';
import path from 'node:path';
import PluginError from './plugin-error';
import { addDefault, addNamed } from '@babel/helper-module-imports';
import { accessibilityProperties } from './constants';

/**
 * Adds a hint to the file object to ensure that a specific import is added only once and cached on the file object.
 *
 * @param opts - Object containing the function arguments:
 *   - file: The Babel file object (e.g. HubFile)
 *   - nameHint: The name hint which also acts as the cache key to ensure the import is only added once (e.g. 'normalizeAccessibilityProps')
 *   - path: The current Babel NodePath
 *   - importName: The named import string (e.g. 'normalizeAccessibilityProps'), used when importType is 'named'
 *   - moduleName: The module to import from (e.g. 'react-native-boost')
 *   - importType: Either 'named' (default) or 'default' to determine the type of import to use.
 *
 * @returns The identifier returned by addNamed or addDefault.
 */
export function addFileImportHint({
  file,
  nameHint,
  path,
  importName,
  moduleName,
  importType = 'named',
}: FileImportOptions): t.Identifier {
  if (!file.__hasImports?.[nameHint]) {
    file.__hasImports = file.__hasImports || {};
    file.__hasImports[nameHint] =
      importType === 'default'
        ? addDefault(path, moduleName, { nameHint })
        : addNamed(path, importName, moduleName, { nameHint });
  }
  return file.__hasImports[nameHint];
}
/**
 * Checks if the file is in the list of ignored files.
 *
 * @param p - The path to the JSXOpeningElement.
 * @param ignores - List of glob paths (absolute or relative to import.meta.dirname).
 * @returns true if the file matches any of the ignore patterns.
 */
export const isIgnoredFile = (p: NodePath<t.JSXOpeningElement>, ignores: string[]): boolean => {
  const hub = p.hub as unknown;
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
    const absolutePattern = path.isAbsolute(pattern) ? pattern : path.join(baseDirectory, pattern);

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
export const shouldIgnoreOptimization = (path: NodePath<t.JSXOpeningElement>): boolean => {
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
      if (typeof key === 'string' && accessibilityProperties.has(key)) {
        return true;
      }
    } else if (t.isJSXSpreadAttribute(attribute)) {
      if (t.isObjectExpression(attribute.argument)) {
        for (const property of attribute.argument.properties) {
          if (
            t.isObjectProperty(property) &&
            t.isIdentifier(property.key) &&
            accessibilityProperties.has(property.key.name)
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
                accessibilityProperties.has(property.key.name)
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

  // Check if the element name matches the target component name
  return path.node.name.name === componentName;
};

/**
 * Checks if the component is imported from 'react-native'.
 *
 * @param path - The NodePath to check.
 * @param componentName - The name of the component to validate.
 * @returns true if the component is imported from 'react-native'.
 */
export const isReactNativeImport = (path: NodePath<t.JSXOpeningElement>, componentName: string): boolean => {
  // Get the binding for the component name
  const binding = path.scope.getBinding(componentName);
  if (!binding) return false;

  // Check if it's a module import
  if (binding.kind === 'module') {
    const parentNode = binding.path.parent;
    // Verify it's imported from 'react-native'
    return t.isImportDeclaration(parentNode) && parentNode.source.value === 'react-native';
  }

  return false;
};

/**
 * Replaces a component with its native counterpart.
 * This function handles both the opening and closing tags.
 *
 * @param path - The path to the JSXOpeningElement.
 * @param parent - The parent JSX element.
 * @param file - The Babel file object.
 * @param nativeComponentName - The name of the native component to import.
 * @param originalComponentName - The name of the original component being replaced.
 * @param moduleName - The module to import the native component from.
 * @returns The identifier for the imported native component.
 */
export const replaceWithNativeComponent = (
  path: NodePath<t.JSXOpeningElement>,
  parent: t.JSXElement,
  file: HubFile,
  nativeComponentName: string,
  originalComponentName: string,
  moduleName: string
): t.Identifier => {
  // Add native component import (cached on file) to prevent duplicate imports
  const nativeIdentifier = addFileImportHint({
    file,
    nameHint: nativeComponentName,
    path,
    importName: nativeComponentName,
    moduleName,
    importType: 'named',
  });

  // Replace the component with its native counterpart
  const jsxName = path.node.name as t.JSXIdentifier;
  jsxName.name = nativeIdentifier.name;

  // If the element is not self-closing, update the closing element as well
  if (
    !path.node.selfClosing &&
    parent.closingElement &&
    t.isJSXIdentifier(parent.closingElement.name) &&
    parent.closingElement.name.name === originalComponentName
  ) {
    parent.closingElement.name.name = nativeIdentifier.name;
  }

  return nativeIdentifier;
};
