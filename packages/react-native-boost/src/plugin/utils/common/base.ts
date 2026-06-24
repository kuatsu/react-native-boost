import { NodePath, types as t } from '@babel/core';
import { addDefault, addNamed } from '@babel/helper-module-imports';
import { FileImportOptions, HubFile } from '../../types';
import { RUNTIME_MODULE_NAME, UNISTYLES_NATIVE_TEXT_MODULE, UNISTYLES_NATIVE_VIEW_MODULE } from '../constants';
import { markOptimizedHost, OptimizedHostKind } from './optimized-host';

/**
 * Adds a hint to the file object to ensure that a specific import is added only once and cached on the file object.
 *
 * @param opts - Object containing the function arguments:
 *   - file: The Babel file object (e.g. HubFile)
 *   - nameHint: The name hint which also acts as the cache key to ensure the import is only added once (e.g. 'processAccessibilityProps')
 *   - path: The current Babel NodePath
 *   - importName: The named import string (e.g. 'processAccessibilityProps'), used when importType is 'named'
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
 * Where to import an optimized element's replacement host from. Defaults to Boost's own runtime
 * (`react-native-boost/runtime`, named import). Unistyles mode overrides this to point at Unistyles'
 * lean host components, which are version-matched registering wrappers (e.g. `NativeView` is a default
 * export). A distinct `nameHint` keeps the import cache from colliding when a file uses both a Boost
 * host and a Unistyles host.
 */
export interface NativeComponentSource {
  moduleName?: string;
  importName?: string;
  importType?: 'named' | 'default';
  nameHint?: string;
}

/** The native hosts Boost rewrites elements into; the local-name basis for each injected import. */
type NativeComponentName = 'NativeText' | 'NativeView';

/** Which context each optimized host establishes for the ancestor walk. Total over every host name. */
const HOST_KIND_BY_NAME: Record<NativeComponentName, OptimizedHostKind> = {
  NativeText: 'text',
  NativeView: 'view',
};

/**
 * Import sources for Unistyles' own lean hosts, passed as the `source` override when an element's `style`
 * resolves to a Unistyles style.
 */
export const UNISTYLES_TEXT_HOST: NativeComponentSource = {
  moduleName: UNISTYLES_NATIVE_TEXT_MODULE,
  importName: 'NativeText',
  nameHint: 'UnistylesNativeText',
};

export const UNISTYLES_VIEW_HOST: NativeComponentSource = {
  moduleName: UNISTYLES_NATIVE_VIEW_MODULE,
  importType: 'default',
  nameHint: 'UnistylesNativeView',
};

/**
 * Replaces a component with its native counterpart.
 * This function handles both the opening and closing tags.
 *
 * @param path - The path to the JSXOpeningElement.
 * @param parent - The parent JSX element.
 * @param file - The Babel file object.
 * @param nativeComponentName - The local-name basis for the injected import (and the default import name).
 * @param source - Optional override for where to import the host from (see {@link NativeComponentSource}).
 * @returns The identifier for the imported native component.
 */
export const replaceWithNativeComponent = (
  path: NodePath<t.JSXOpeningElement>,
  parent: t.JSXElement,
  file: HubFile,
  nativeComponentName: NativeComponentName,
  source: NativeComponentSource = {}
): t.Identifier => {
  // Add native component import (cached on file) to prevent duplicate imports
  const nativeIdentifier = addFileImportHint({
    file,
    nameHint: source.nameHint ?? nativeComponentName,
    path,
    importName: source.importName ?? nativeComponentName,
    moduleName: source.moduleName ?? RUNTIME_MODULE_NAME,
    importType: source.importType ?? 'named',
  });

  // Get the current name of the component, which may be aliased (i.e. Text -> RNText)
  const currentName = (path.node.name as t.JSXIdentifier).name;

  // Record what this element was optimized into so the ancestor walk can classify it once it becomes a
  // descendant's ancestor (the injected import is not yet resolvable via scope this traversal).
  markOptimizedHost(path.node, HOST_KIND_BY_NAME[nativeComponentName]);

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
