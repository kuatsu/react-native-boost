import { NodePath, types as t } from '@babel/core';
import { addDefault, addNamed } from '@babel/helper-module-imports';
import { FileImportOptions, HubFile } from '../../types';
import { RUNTIME_MODULE_NAME } from '../constants';

/**
 * Adds a hint to the file object to ensure that a specific import is added only once and cached on the file object.
 *
 * @param opts - Object containing the function arguments:
 *   - file: The Babel file object (e.g. HubFile)
 *   - nameHint: The name hint which also acts as the cache key to ensure the import is only added once (e.g. 'normalizeAccessibilityProps')
 *   - path: The current Babel NodePath
 *   - importName: The named import string (e.g. 'normalizeAccessibilityProps'), used when importType is 'named'
 *   - moduleName: The module to import from (e.g. 'react-native-boost/runtime')
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
 * Replaces a component with its native counterpart.
 * This function handles both the opening and closing tags.
 *
 * @param path - The path to the JSXOpeningElement.
 * @param parent - The parent JSX element.
 * @param file - The Babel file object.
 * @param nativeComponentName - The name of the native component to import.
 * @param moduleName - The module to import the native component from.
 * @returns The identifier for the imported native component.
 */
export const replaceWithNativeComponent = (
  path: NodePath<t.JSXOpeningElement>,
  parent: t.JSXElement,
  file: HubFile,
  nativeComponentName: string
): t.Identifier => {
  // Add native component import (cached on file) to prevent duplicate imports
  const nativeIdentifier = addFileImportHint({
    file,
    nameHint: nativeComponentName,
    path,
    importName: nativeComponentName,
    moduleName: RUNTIME_MODULE_NAME,
    importType: 'named',
  });

  // Get the current name of the component, which may be aliased (i.e. Text -> RNText)
  const currentName = (path.node.name as t.JSXIdentifier).name;

  // Replace the component with its native counterpart
  const jsxName = path.node.name as t.JSXIdentifier;
  jsxName.name = nativeIdentifier.name;

  // If the element is not self-closing, update the closing element as well
  if (
    !path.node.selfClosing &&
    parent.closingElement &&
    t.isJSXIdentifier(parent.closingElement.name) &&
    parent.closingElement.name.name === currentName
  ) {
    parent.closingElement.name.name = nativeIdentifier.name;
  }

  return nativeIdentifier;
};
