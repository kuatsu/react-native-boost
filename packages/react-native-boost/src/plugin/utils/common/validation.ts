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
