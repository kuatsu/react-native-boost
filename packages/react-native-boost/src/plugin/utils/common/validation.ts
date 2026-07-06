import { NodePath, types as t } from '@babel/core';
import { ensureArray, BailoutCheck } from '../helpers';
import { HubFile, TransparentWrapperEntry, TransparentWrapperHost } from '../../types';
import { minimatch } from 'minimatch';
import nodePath from 'node:path';
import PluginError from '../plugin-error';
import {
  UNISTYLES_MODULE_NAME,
  UNISTYLES_NATIVE_TEXT_MODULE,
  UNISTYLES_NATIVE_VIEW_MODULE,
  RUNTIME_MODULE_NAME,
} from '../constants';
import { getOptimizedHostKind } from './optimized-host';
import { extractStyleAttribute } from './attributes';

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

export const isForcedLine = (path: NodePath<t.JSXOpeningElement>): boolean => {
  return hasDecoratorComment(path, '@boost-force');
};

export const isIgnoredLine = (path: NodePath<t.JSXOpeningElement>): boolean => {
  return hasDecoratorComment(path, '@boost-ignore');
};

/**
 * Checks if the JSX element has a preceding comment containing the given decorator string.
 *
 * Scans the JSXOpeningElement's own leading comments, the parent element's comments,
 * ObjectProperty containers, and backward siblings.
 */
function hasDecoratorComment(path: NodePath<t.JSXOpeningElement>, decorator: string): boolean {
  if (path.node.leadingComments?.some((comment) => comment.value.includes(decorator))) {
    return true;
  }

  const jsxElementPath = path.parentPath;
  if (jsxElementPath.node.leadingComments?.some((comment) => comment.value.includes(decorator))) {
    return true;
  }

  // Check leading comments on the ObjectProperty (if the JSX element is a value inside an object literal).
  const propertyPath = jsxElementPath.parentPath;
  if (
    propertyPath &&
    propertyPath.isObjectProperty() &&
    propertyPath.node.leadingComments?.some((comment) => comment.value.includes(decorator))
  ) {
    return true;
  }

  if (!jsxElementPath.parentPath) return false;

  const containerPath = jsxElementPath.parentPath;
  const siblings = ensureArray(containerPath.get('children'));
  const index = siblings.findIndex((sibling) => sibling.node === jsxElementPath.node);
  if (index === -1) return false;

  for (let index_ = index - 1; index_ >= 0; index_--) {
    const sibling = siblings[index_];
    if (sibling.isJSXText() && sibling.node.value.trim() === '') {
      continue;
    }
    if (sibling.isJSXExpressionContainer()) {
      const expression = sibling.get('expression');
      if (expression && expression.node) {
        const comments = [
          ...(expression.node.leadingComments || []),
          ...(expression.node.trailingComments || []),
          ...(expression.node.innerComments || []),
        ].map((comment) => comment.value.trim());
        if (comments.some((comment) => comment.includes(decorator))) {
          return true;
        }
      }
    }
    if (
      sibling.node.leadingComments &&
      sibling.node.leadingComments.some((comment) => comment.value.includes(decorator))
    ) {
      return true;
    }
    break;
  }
  return false;
}

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

export type AncestorClassification = 'safe' | 'text' | 'unknown';
type ScopeBinding = NonNullable<ReturnType<NodePath<t.Node>['scope']['getBinding']>>;

type AncestorAnalysisContext = {
  componentCache: WeakMap<t.Node, AncestorClassification>;
  componentInProgress: WeakSet<t.Node>;
  renderExpressionInProgress: WeakSet<t.Node>;
  transparentWrappers: TransparentWrapperEntry[];
};

export const getAncestorClassification = (
  path: NodePath<t.JSXOpeningElement>,
  transparentWrappers: TransparentWrapperEntry[] = []
): AncestorClassification => {
  const context: AncestorAnalysisContext = {
    componentCache: new WeakMap<t.Node, AncestorClassification>(),
    componentInProgress: new WeakSet<t.Node>(),
    renderExpressionInProgress: new WeakSet<t.Node>(),
    transparentWrappers,
  };

  let classification: AncestorClassification = 'safe';
  let ancestorPath: NodePath<t.Node> | null = path.parentPath.parentPath;

  while (ancestorPath) {
    if (ancestorPath.isJSXElement()) {
      const ancestorClassification = classifyJSXElementAsAncestor(ancestorPath, context);
      classification = mergeAncestorClassification(classification, ancestorClassification);

      if (classification === 'text') return classification;
    }

    ancestorPath = ancestorPath.parentPath;
  }

  return classification;
};

/**
 * The ancestor-safety bailout checks shared by the Text and View optimizers. An element nested under a
 * `Text` renders as the inline `NativeVirtualText` host (`RCTVirtualText`) instead of the block
 * `NativeText`/`NativeView` host, so optimizing it would emit the wrong host; an `'unknown'` ancestor
 * chain cannot be proven free of such a `Text`, so it bails too unless the caller opts into the risk.
 *
 * The ancestor walk is lazy (it runs only if these checks are reached) and memoized across the two
 * checks. Each optimizer passes its own resolved `dangerouslyOptimize*WithUnknownAncestors` flag.
 */
export const ancestorBailoutChecks = (
  path: NodePath<t.JSXOpeningElement>,
  dangerousOptimizationEnabled: boolean,
  transparentWrappers: TransparentWrapperEntry[] = []
): BailoutCheck[] => {
  let classification: AncestorClassification | undefined;
  const classify = () => (classification ??= getAncestorClassification(path, transparentWrappers));

  return [
    {
      reason: 'has Text ancestor',
      shouldBail: () => classify() === 'text',
    },
    {
      reason: 'has unresolved ancestor and dangerous optimization is disabled',
      shouldBail: () => classify() === 'unknown' && !dangerousOptimizationEnabled,
    },
  ];
};

function classifyJSXElementAsAncestor(
  path: NodePath<t.JSXElement>,
  context: AncestorAnalysisContext
): AncestorClassification {
  // An ancestor Boost already rewrote earlier in this same traversal: classify it by the host it
  // became (Text → inline-text context, View → normal context). This is checked before the import-based
  // paths because the freshly-injected host import is not yet resolvable via scope.
  const optimizedHostKind = getOptimizedHostKind(path.node.openingElement);
  if (optimizedHostKind) return optimizedHostKind === 'text' ? 'text' : 'safe';

  const openingElementName = path.node.openingElement.name;

  if (t.isJSXIdentifier(openingElementName)) {
    return classifyJSXIdentifierAsAncestor(path, openingElementName.name, context);
  }

  if (t.isJSXMemberExpression(openingElementName)) {
    return classifyJSXMemberExpressionAsAncestor(path, openingElementName);
  }

  return 'unknown';
}

function classifyJSXIdentifierAsAncestor(
  path: NodePath<t.JSXElement>,
  identifierName: string,
  context: AncestorAnalysisContext
): AncestorClassification {
  if (identifierName === 'Fragment') return 'safe';

  const binding = path.scope.getBinding(identifierName);
  if (!binding) return 'unknown';

  return classifyBindingAsAncestor(binding, context);
}

function classifyJSXMemberExpressionAsAncestor(
  path: NodePath<t.JSXElement>,
  expression: t.JSXMemberExpression
): AncestorClassification {
  if (!t.isJSXIdentifier(expression.object) || !t.isJSXIdentifier(expression.property)) {
    return 'unknown';
  }

  const binding = path.scope.getBinding(expression.object.name);
  if (!binding || binding.kind !== 'module' || !t.isImportNamespaceSpecifier(binding.path.node)) {
    return 'unknown';
  }

  const importDeclaration = binding.path.parent;
  if (!t.isImportDeclaration(importDeclaration)) return 'unknown';

  if (importDeclaration.source.value === 'react-native') {
    return expression.property.name === 'Text' ? 'text' : 'safe';
  }

  if (importDeclaration.source.value === 'react' && expression.property.name === 'Fragment') {
    return 'safe';
  }

  return 'unknown';
}

function classifyBindingAsAncestor(binding: ScopeBinding, context: AncestorAnalysisContext): AncestorClassification {
  if (binding.kind === 'module') {
    return classifyModuleBindingAsAncestor(binding, context);
  }

  return classifyLocalBindingAsAncestor(binding, context);
}

function classifyModuleBindingAsAncestor(
  binding: ScopeBinding,
  context: AncestorAnalysisContext
): AncestorClassification {
  const importDeclaration = binding.path.parent;
  if (!t.isImportDeclaration(importDeclaration)) return 'unknown';

  const source = importDeclaration.source.value;
  if (source === 'react-native') {
    if (t.isImportSpecifier(binding.path.node)) {
      const importedName = getImportSpecifierImportedName(binding.path.node);
      if (!importedName) return 'unknown';
      return importedName === 'Text' ? 'text' : 'safe';
    }

    if (t.isImportNamespaceSpecifier(binding.path.node)) {
      return 'safe';
    }

    return 'unknown';
  }

  // An ancestor Boost itself already rewrote (its own runtime host, or a Unistyles lean host in
  // Unistyles mode) is a *known* host: a View establishes a normal context ('safe'), a Text an
  // inline-text context ('text'). Without this, a descendant of an optimized element would read its
  // rewritten ancestor as 'unknown' and bail — so only the outermost element of any subtree could ever
  // optimize. Classifying by what the host renders lets optimization cascade down the tree.
  const optimizedHost = classifyOptimizedHostAncestor(source, binding);
  if (optimizedHost) return optimizedHost;

  if (source === 'react' && t.isImportSpecifier(binding.path.node)) {
    const importedName = getImportSpecifierImportedName(binding.path.node);
    if (importedName === 'Fragment') return 'safe';
  }

  // A component the user registered as a transparent passthrough wrapper classifies by the host it
  // declares — 'view' establishes a normal context like a real View, 'text' an inline-text context
  // like a real Text. Matched on the *imported* name (alias-proof), named imports only.
  if (t.isImportSpecifier(binding.path.node)) {
    const importedName = getImportSpecifierImportedName(binding.path.node);
    if (importedName) {
      const transparentHost = resolveTransparentWrapper(source, importedName, context.transparentWrappers);
      if (transparentHost === 'view') return 'safe';
      if (transparentHost === 'text') return 'text';
    }
  }

  return 'unknown';
}

/**
 * Looks up an imported component in the user-registered transparent wrapper entries. Returns the host
 * kind the wrapper renders to, or `undefined` when the (module, export) pair is not registered.
 */
function resolveTransparentWrapper(
  source: string,
  importedName: string,
  entries: TransparentWrapperEntry[]
): TransparentWrapperHost | undefined {
  for (const entry of entries) {
    if (entry.module !== source) continue;
    const host = entry.components[importedName];
    if (host) return host;
  }

  return undefined;
}

/**
 * Classifies an ancestor that is one of the optimized hosts Boost emits — its own runtime
 * `NativeText`/`NativeView`, or (in Unistyles mode) Unistyles' lean `NativeText`/`NativeView`. Returns
 * `'text'` for a Text host, `'safe'` for a View host, or `undefined` when the source is not a known
 * optimized host. The Unistyles lean hosts are keyed purely by their (component-specific) import source;
 * Boost's own runtime exports both hosts from one module, so its imported name is checked.
 */
function classifyOptimizedHostAncestor(source: string, binding: ScopeBinding): AncestorClassification | undefined {
  if (source === UNISTYLES_NATIVE_TEXT_MODULE) return 'text';
  if (source === UNISTYLES_NATIVE_VIEW_MODULE) return 'safe';

  if (source === RUNTIME_MODULE_NAME && t.isImportSpecifier(binding.path.node)) {
    const importedName = getImportSpecifierImportedName(binding.path.node);
    if (importedName === 'NativeText') return 'text';
    if (importedName === 'NativeView') return 'safe';
  }

  return undefined;
}

function classifyLocalBindingAsAncestor(
  binding: ScopeBinding,
  context: AncestorAnalysisContext
): AncestorClassification {
  const cacheKey = binding.path.node;
  const cached = context.componentCache.get(cacheKey);
  if (cached) return cached;

  if (context.componentInProgress.has(cacheKey)) {
    return 'unknown';
  }

  context.componentInProgress.add(cacheKey);

  let classification: AncestorClassification;
  if (binding.path.isFunctionDeclaration()) {
    classification = analyzeFunctionComponent(binding.path, context);
  } else if (binding.path.isVariableDeclarator()) {
    classification = analyzeVariableDeclaratorComponent(binding.path, context);
  } else {
    classification = 'unknown';
  }

  context.componentInProgress.delete(cacheKey);
  context.componentCache.set(cacheKey, classification);

  return classification;
}

function analyzeVariableDeclaratorComponent(
  path: NodePath<t.VariableDeclarator>,
  context: AncestorAnalysisContext
): AncestorClassification {
  const initPath = path.get('init');
  if (!initPath.node) return 'unknown';

  if (initPath.isArrowFunctionExpression() || initPath.isFunctionExpression()) {
    return analyzeFunctionComponent(initPath, context);
  }

  if (initPath.isCallExpression()) {
    return analyzeCallWrappedComponent(initPath, context);
  }

  if (initPath.isIdentifier()) {
    const aliasBinding = path.scope.getBinding(initPath.node.name);
    if (!aliasBinding) return 'unknown';

    return classifyBindingAsAncestor(aliasBinding, context);
  }

  return 'unknown';
}

function analyzeCallWrappedComponent(
  path: NodePath<t.CallExpression>,
  context: AncestorAnalysisContext
): AncestorClassification {
  if (!isReactMemoOrForwardRefCall(path)) return 'unknown';

  const [firstArgumentPath] = path.get('arguments');
  if (!firstArgumentPath?.node) return 'unknown';

  if (firstArgumentPath.isArrowFunctionExpression() || firstArgumentPath.isFunctionExpression()) {
    return analyzeFunctionComponent(firstArgumentPath, context);
  }

  if (firstArgumentPath.isIdentifier()) {
    const wrappedComponentBinding = path.scope.getBinding(firstArgumentPath.node.name);
    if (!wrappedComponentBinding) return 'unknown';

    return classifyBindingAsAncestor(wrappedComponentBinding, context);
  }

  if (firstArgumentPath.isCallExpression()) {
    return analyzeCallWrappedComponent(firstArgumentPath, context);
  }

  return 'unknown';
}

function isReactMemoOrForwardRefCall(path: NodePath<t.CallExpression>): boolean {
  const calleePath = path.get('callee');

  if (calleePath.isIdentifier()) {
    if (!isMemoOrForwardRefName(calleePath.node.name)) return false;

    const binding = path.scope.getBinding(calleePath.node.name);
    return isReactImportBinding(binding);
  }

  if (calleePath.isMemberExpression()) {
    const objectPath = calleePath.get('object');
    const propertyPath = calleePath.get('property');

    if (!objectPath.isIdentifier() || !propertyPath.isIdentifier()) return false;
    if (!isMemoOrForwardRefName(propertyPath.node.name)) return false;

    const objectBinding = path.scope.getBinding(objectPath.node.name);
    return isReactImportBinding(objectBinding);
  }

  return false;
}

function isMemoOrForwardRefName(name: string): boolean {
  return name === 'memo' || name === 'forwardRef';
}

function isReactImportBinding(binding: ScopeBinding | undefined): binding is ScopeBinding {
  if (!binding || binding.kind !== 'module') return false;

  const importDeclaration = binding.path.parent;
  return t.isImportDeclaration(importDeclaration) && importDeclaration.source.value === 'react';
}

function analyzeFunctionComponent(
  path: NodePath<t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression>,
  context: AncestorAnalysisContext
): AncestorClassification {
  const bodyPath = path.get('body');

  if (!bodyPath.isBlockStatement()) {
    return analyzeRenderExpression(bodyPath as NodePath<t.Node>, context);
  }

  let classification: AncestorClassification = 'safe';

  for (const statementPath of bodyPath.get('body')) {
    if (!statementPath.isReturnStatement()) continue;

    const argumentPath = statementPath.get('argument');
    if (!argumentPath.node) continue;

    const returnClassification = analyzeRenderExpression(argumentPath as NodePath<t.Node>, context);
    classification = mergeAncestorClassification(classification, returnClassification);

    if (classification === 'text') return classification;
  }

  return classification;
}

function analyzeRenderExpression(path: NodePath<t.Node>, context: AncestorAnalysisContext): AncestorClassification {
  if (path.isJSXFragment()) {
    return analyzeJSXChildren(path.get('children'), context);
  }

  let classification: AncestorClassification = 'safe';
  let hasJSX = false;

  path.traverse({
    JSXOpeningElement(jsxPath) {
      hasJSX = true;

      const jsxElementPath = jsxPath.parentPath;
      if (!jsxElementPath.isJSXElement()) {
        classification = mergeAncestorClassification(classification, 'unknown');
        return;
      }

      const jsxClassification = classifyJSXElementAsAncestor(jsxElementPath, context);
      classification = mergeAncestorClassification(classification, jsxClassification);

      if (classification === 'text') {
        jsxPath.stop();
      }
    },
  });

  if (hasJSX) return classification;

  if (path.isIdentifier()) {
    return analyzeIdentifierRenderExpression(path, context);
  }

  if (path.isMemberExpression() && isPropsChildrenMemberExpression(path.node)) {
    return 'safe';
  }

  if (
    path.isNullLiteral() ||
    path.isBooleanLiteral() ||
    path.isNumericLiteral() ||
    path.isStringLiteral() ||
    path.isBigIntLiteral()
  ) {
    return 'safe';
  }

  return 'unknown';
}

function analyzeJSXChildren(
  children: Array<NodePath<t.JSXText | t.JSXExpressionContainer | t.JSXSpreadChild | t.JSXElement | t.JSXFragment>>,
  context: AncestorAnalysisContext
): AncestorClassification {
  let classification: AncestorClassification = 'safe';

  for (const childPath of children) {
    if (childPath.isJSXElement()) {
      const childClassification = classifyJSXElementAsAncestor(childPath, context);
      classification = mergeAncestorClassification(classification, childClassification);
    } else if (childPath.isJSXFragment()) {
      const fragmentClassification = analyzeJSXChildren(childPath.get('children'), context);
      classification = mergeAncestorClassification(classification, fragmentClassification);
    } else if (childPath.isJSXExpressionContainer()) {
      const expressionPath = childPath.get('expression');
      if (!expressionPath.node || expressionPath.isJSXEmptyExpression()) continue;

      const expressionClassification = analyzeRenderExpression(expressionPath as NodePath<t.Node>, context);
      classification = mergeAncestorClassification(classification, expressionClassification);
    } else if (childPath.isJSXSpreadChild()) {
      classification = mergeAncestorClassification(classification, 'unknown');
    }

    if (classification === 'text') {
      return classification;
    }
  }

  return classification;
}

function analyzeIdentifierRenderExpression(
  path: NodePath<t.Identifier>,
  context: AncestorAnalysisContext
): AncestorClassification {
  if (path.node.name === 'children') return 'safe';

  const binding = path.scope.getBinding(path.node.name);
  if (!binding) return 'unknown';

  if (binding.kind === 'param') {
    return binding.identifier.name === 'children' ? 'safe' : 'unknown';
  }

  if (!binding.path.isVariableDeclarator()) return 'unknown';

  const cacheKey = binding.path.node;
  if (context.renderExpressionInProgress.has(cacheKey)) {
    return 'unknown';
  }

  const initPath = binding.path.get('init');
  if (!initPath.node) return 'unknown';

  context.renderExpressionInProgress.add(cacheKey);
  const classification = analyzeRenderExpression(initPath as NodePath<t.Node>, context);
  context.renderExpressionInProgress.delete(cacheKey);

  return classification;
}

function isPropsChildrenMemberExpression(expression: t.MemberExpression): boolean {
  if (!t.isIdentifier(expression.object, { name: 'props' })) return false;
  if (!t.isIdentifier(expression.property, { name: 'children' })) return false;
  return !expression.computed;
}

function mergeAncestorClassification(
  current: AncestorClassification,
  next: AncestorClassification
): AncestorClassification {
  if (current === 'text' || next === 'text') return 'text';
  if (current === 'unknown' || next === 'unknown') return 'unknown';
  return 'safe';
}

function getImportSpecifierImportedName(specifier: t.ImportSpecifier): string | undefined {
  if (t.isIdentifier(specifier.imported)) {
    return specifier.imported.name;
  }

  if (t.isStringLiteral(specifier.imported)) {
    return specifier.imported.value;
  }

  return undefined;
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

export type StyleOrigin = 'unistyles' | 'plain' | 'unknown';

// Bounds the alias/array/wrapper recursion in `classifyStyleExpression`, which would otherwise loop
// forever on a pathological const cycle (`const a = b; const b = a`). Past this depth the source is
// undecidable, so it classifies as `'unknown'` (a safe bail).
const MAX_STYLE_RESOLUTION_DEPTH = 64;

/**
 * Builds a lazily-memoized resolver for an element's direct `style` origin, shared by the `Text` and
 * `View` optimizers. Outside Unistyles mode it is a constant `'plain'` (no work). Inside, it classifies
 * on first call and caches — kept lazy so an element that bails on a cheaper check never pays the
 * classification cost.
 */
export const createStyleOriginResolver = (
  path: NodePath<t.JSXOpeningElement>,
  unistylesEnabled: boolean | undefined
): (() => StyleOrigin) => {
  if (!unistylesEnabled) return () => 'plain';

  let styleOrigin: StyleOrigin | undefined;
  return () => (styleOrigin ??= classifyStyleOrigin(path, extractStyleAttribute(path.node.attributes).styleExpr));
};

/**
 * Classifies where a JSX element's direct `style` value comes from, used to route an element in
 * "Unistyles mode". Resolution is **same-file only** — anything that would require following an import,
 * or that cannot be proven, is `'unknown'`.
 *
 * - `'plain'` — no `style`, an object literal, or a `StyleSheet.create(...)` imported from `react-native`:
 *   provably not a Unistyles style, so it is safe to optimize to Boost's own host as usual.
 * - `'unistyles'` — a `StyleSheet.create(...)` imported from `react-native-unistyles`, used directly or as
 *   any element of a style array: must be routed to Unistyles' lean host so its registration survives.
 * - `'unknown'` — a prop/param/call/conditional, an imported stylesheet, or any unresolvable reference:
 *   undecidable within one file, so it could be a Unistyles style arriving from elsewhere.
 */
export const classifyStyleOrigin = (
  path: NodePath<t.JSXOpeningElement>,
  styleExpr: t.Expression | undefined
): StyleOrigin => {
  if (!styleExpr) return 'plain';
  return classifyStyleExpression(path, styleExpr);
};

function classifyStyleExpression(path: NodePath<t.JSXOpeningElement>, expr: t.Expression, depth = 0): StyleOrigin {
  if (depth > MAX_STYLE_RESOLUTION_DEPTH) return 'unknown';

  // TS-only and parenthesized wrappers do not change the runtime style value, so `styles.foo as TextStyle`,
  // `styles.foo!`, `styles.foo satisfies …`, and `(styles.foo)` classify exactly like `styles.foo`.
  if (
    t.isTSAsExpression(expr) ||
    t.isTSSatisfiesExpression(expr) ||
    t.isTSNonNullExpression(expr) ||
    t.isParenthesizedExpression(expr)
  ) {
    return classifyStyleExpression(path, expr.expression, depth + 1);
  }

  // An inline object literal could only carry Unistyles state by spreading one in — which strips that
  // state anyway and is already broken under Unistyles — so a spread makes it unprovable; a plain
  // literal is provably non-Unistyles.
  if (t.isObjectExpression(expr)) {
    return expr.properties.some((property) => t.isSpreadElement(property)) ? 'unknown' : 'plain';
  }

  if (t.isArrayExpression(expr)) {
    let result: StyleOrigin = 'plain';
    for (const element of expr.elements) {
      if (element == null) continue; // hole → flattens away
      if (t.isSpreadElement(element)) return 'unknown';
      const elementOrigin = classifyStyleExpression(path, element, depth + 1);
      // A single Unistyles element makes the whole array Unistyles-managed: routing the array by
      // identity to the lean host preserves that element's registration regardless of its siblings.
      if (elementOrigin === 'unistyles') return 'unistyles';
      if (elementOrigin === 'unknown') result = 'unknown';
    }
    return result;
  }

  // `styles.foo` / `styles['foo']` / `styles?.foo` — classify by the `styles` container's origin.
  if (t.isMemberExpression(expr) || t.isOptionalMemberExpression(expr)) {
    if (!t.isIdentifier(expr.object)) return 'unknown';
    return classifyStyleContainerBinding(path.scope.getBinding(expr.object.name));
  }

  // A local `const x = <style expr>` alias — follow it.
  if (t.isIdentifier(expr)) {
    const binding = path.scope.getBinding(expr.name);
    if (!binding || !binding.constant || !binding.path.isVariableDeclarator()) return 'unknown';
    const init = binding.path.node.init;
    if (init && t.isExpression(init)) return classifyStyleExpression(path, init, depth + 1);
    return 'unknown';
  }

  return 'unknown';
}

/**
 * Classifies the binding behind the `styles` in `styles.foo`: it must be a same-file, non-reassigned
 * `const styles = <StyleSheet>.create(...)` whose `StyleSheet` import source identifies the engine.
 */
function classifyStyleContainerBinding(binding: ScopeBinding | undefined): StyleOrigin {
  if (!binding || !binding.constant) return 'unknown';
  if (binding.kind === 'module') return 'unknown'; // imported stylesheet → cross-file, out of scope
  if (!binding.path.isVariableDeclarator()) return 'unknown';

  const init = binding.path.node.init;
  if (!init || !t.isCallExpression(init)) return 'unknown';

  return classifyStyleSheetCreateCallee(binding.path.scope, init.callee);
}

/**
 * Classifies a `StyleSheet.create` callee by the import source of its `StyleSheet` object:
 * `react-native-unistyles` → `'unistyles'`, `react-native` → `'plain'`, anything else → `'unknown'`.
 */
function classifyStyleSheetCreateCallee(
  scope: NodePath<t.Node>['scope'],
  callee: t.Expression | t.V8IntrinsicIdentifier
): StyleOrigin {
  if (!t.isMemberExpression(callee) || callee.computed) return 'unknown';
  if (!t.isIdentifier(callee.property, { name: 'create' })) return 'unknown';
  if (!t.isIdentifier(callee.object)) return 'unknown';

  const binding = scope.getBinding(callee.object.name);
  if (!binding || binding.kind !== 'module' || !t.isImportDeclaration(binding.path.parent)) return 'unknown';

  const source = binding.path.parent.source.value;
  if (source === UNISTYLES_MODULE_NAME) return 'unistyles';
  if (source === 'react-native') return 'plain';
  return 'unknown';
}
