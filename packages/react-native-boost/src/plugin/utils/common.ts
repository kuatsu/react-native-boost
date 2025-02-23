import { NodePath, types as t } from '@babel/core';
import { ensureArray } from './helpers';

/**
 * Checks if the JSX element should be ignored based on a preceding comment.
 *
 * The function looks up the parent container's children, finds the current
 * JSX element, and then (ignoring whitespace-only nodes) inspects the previous
 * sibling for a comment that includes "@boost-ignore".
 */
export const shouldIgnoreOptimization = (path: NodePath<t.JSXOpeningElement>): boolean => {
  // Get the JSX element by going up one level (opening element -> JSXElement)
  const jsxElementPath = path.parentPath;
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
