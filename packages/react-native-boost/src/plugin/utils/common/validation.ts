import { NodePath, types as t } from '@babel/core';
import { ensureArray, BailoutCheck } from '../helpers';
import { HubFile } from '../../types';
import { minimatch } from 'minimatch';
import nodePath from 'node:path';
import {
  UNISTYLES_MODULE_NAME,
  UNISTYLES_NATIVE_TEXT_MODULE,
  UNISTYLES_NATIVE_VIEW_MODULE,
  RUNTIME_MODULE_NAME,
} from '../constants';
import { getMarkedReactNativeComponent } from './optimized-host';
import { extractStyleAttribute } from './attributes';

/** Checks if a file matches one of the configured ignore patterns. */
export const isIgnoredFile = (file: HubFile, ignores: string[]): boolean => {
  const fileName = file.opts.filename;
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

export const isForcedLine = (path: NodePath): boolean => hasDecoratorComment(path, '@boost-force');

export const isIgnoredLine = (path: NodePath): boolean => hasDecoratorComment(path, '@boost-ignore');

function hasDecoratorComment(path: NodePath, decorator: string): boolean {
  if (path.isJSXOpeningElement()) return hasJSXDecoratorComment(path, decorator);

  let currentPath: NodePath | null = path;
  while (currentPath) {
    if (currentPath.node.leadingComments?.some((comment) => comment.value.includes(decorator))) return true;
    if (currentPath.isStatement()) break;
    currentPath = currentPath.parentPath;
  }
  return false;
}

/** Finds JSX decorators attached to the element or its preceding JSX comment. */
function hasJSXDecoratorComment(path: NodePath<t.JSXOpeningElement>, decorator: string): boolean {
  if (path.node.leadingComments?.some((comment) => comment.value.includes(decorator))) return true;

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

export function isModuleImportBinding(
  binding: ReturnType<NodePath['scope']['getBinding']>,
  source: string,
  isSpecifier: (node: t.Node) => boolean,
  importedName?: string
): boolean {
  if (!binding || binding.kind !== 'module' || !isSpecifier(binding.path.node)) return false;
  if (!t.isImportDeclaration(binding.path.parent) || binding.path.parent.source.value !== source) return false;
  if (binding.path.parent.importKind === 'type') return false;
  if (t.isImportSpecifier(binding.path.node)) {
    return (
      binding.path.node.importKind !== 'type' &&
      (importedName === undefined || t.isIdentifier(binding.path.node.imported, { name: importedName }))
    );
  }
  return importedName === undefined;
}

export const isReactNativeComponent = (path: NodePath<t.JSXOpeningElement>, expectedImportedName: string): boolean => {
  if (getMarkedReactNativeComponent(path.node) === expectedImportedName) return true;
  if (!t.isJSXIdentifier(path.node.name) || !t.isJSXElement(path.parent)) return false;

  const localName = path.node.name.name;
  const binding = path.scope.getBinding(localName);
  if (binding?.kind !== 'module' || !t.isImportDeclaration(binding.path.parent)) return false;
  if (binding.path.parent.source.value !== 'react-native') return false;

  if (t.isImportSpecifier(binding.path.node)) {
    return t.isIdentifier(binding.path.node.imported, { name: expectedImportedName });
  }

  return t.isImportDefaultSpecifier(binding.path.node) && localName === expectedImportedName;
};

export type AncestorClassification = 'safe' | 'text' | 'unknown';
type ComponentAncestorClassification = AncestorClassification | 'transparent';
type ScopeBinding = NonNullable<ReturnType<NodePath<t.Node>['scope']['getBinding']>>;

type AncestorAnalysisContext = {
  componentCache: WeakMap<t.Node, ComponentAncestorClassification>;
  componentInProgress: WeakSet<t.Node>;
};

type TextContextSource = AncestorClassification | 'runtime';

export const getAncestorClassification = (path: NodePath<t.JSXOpeningElement>): AncestorClassification => {
  const source = getTextContextSource(path);
  return source === 'runtime' ? 'safe' : source;
};

/** Whether an element has no JSX ancestor that determines its runtime text context. */
export const inheritsTextContextFromRuntimeParent = (path: NodePath<t.JSXOpeningElement>): boolean =>
  getTextContextSource(path) === 'runtime';

function getTextContextSource(path: NodePath<t.JSXOpeningElement>): TextContextSource {
  const context: AncestorAnalysisContext = {
    componentCache: new WeakMap<t.Node, ComponentAncestorClassification>(),
    componentInProgress: new WeakSet<t.Node>(),
  };
  let childPath: NodePath<t.Node> = path.parentPath;
  let ancestorPath = childPath.parentPath;

  while (ancestorPath) {
    if (ancestorPath.isJSXElement() || ancestorPath.isJSXFragment()) {
      if (childPath.listKey !== 'children') return 'unknown';

      if (ancestorPath.isJSXElement()) {
        const classification = classifyJSXElementAsAncestor(ancestorPath, context);
        if (classification !== 'transparent') return classification;
      }
    }

    if (ancestorPath.isExpressionStatement() && ancestorPath.parentPath?.isProgram()) {
      const expressionPath = ancestorPath.get('expression');
      return expressionPath.isJSXElement() || expressionPath.isJSXFragment() ? 'safe' : 'runtime';
    }

    if (ancestorPath.isFunction()) return 'runtime';

    childPath = ancestorPath;
    ancestorPath = ancestorPath.parentPath;
  }

  return 'runtime';
}

/**
 * The ancestor-safety bailout checks shared by the host-component optimizers. An element nested under
 * a `Text` can need a different native host, so optimization would be incorrect. An `'unknown'`
 * ancestor chain also bails unless the project asserts that unknown ancestors do not render `Text`.
 */
export const ancestorBailoutChecks = (
  path: NodePath<t.JSXOpeningElement>,
  unknownAncestorsDoNotRenderText: boolean
): BailoutCheck[] => {
  let classification: AncestorClassification | undefined;
  const classify = () => (classification ??= getAncestorClassification(path));

  return [
    {
      reason: 'has Text ancestor',
      shouldBail: () => classify() === 'text',
    },
    {
      reason: 'has unresolved ancestor that may render Text',
      shouldBail: () => classify() === 'unknown' && !unknownAncestorsDoNotRenderText,
    },
  ];
};

function isReactFragmentElement(path: NodePath<t.JSXElement>): boolean {
  const name = path.node.openingElement.name;

  if (t.isJSXIdentifier(name)) {
    const binding = path.scope.getBinding(name.name);
    return (
      isReactImportBinding(binding) &&
      t.isImportSpecifier(binding.path.node) &&
      getImportSpecifierImportedName(binding.path.node) === 'Fragment'
    );
  }

  return (
    t.isJSXMemberExpression(name) &&
    t.isJSXIdentifier(name.object) &&
    t.isJSXIdentifier(name.property, { name: 'Fragment' }) &&
    isReactImportBinding(path.scope.getBinding(name.object.name))
  );
}

function classifyJSXElementAsAncestor(
  path: NodePath<t.JSXElement>,
  context: AncestorAnalysisContext
): ComponentAncestorClassification {
  if (isReactFragmentElement(path)) return 'transparent';

  const markedComponent = getMarkedReactNativeComponent(path.node.openingElement);
  if (markedComponent) return markedComponent === 'Text' ? 'text' : 'safe';

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
): ComponentAncestorClassification {
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

  return 'unknown';
}

function classifyBindingAsAncestor(
  binding: ScopeBinding,
  context: AncestorAnalysisContext
): ComponentAncestorClassification {
  if (binding.kind === 'module') {
    return classifyModuleBindingAsAncestor(binding);
  }

  return classifyLocalBindingAsAncestor(binding, context);
}

function classifyModuleBindingAsAncestor(binding: ScopeBinding): ComponentAncestorClassification {
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
    if (importedName === 'Fragment') return 'transparent';
  }

  return 'unknown';
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
): ComponentAncestorClassification {
  const cacheKey = binding.path.node;
  const cached = context.componentCache.get(cacheKey);
  if (cached) return cached;

  if (context.componentInProgress.has(cacheKey)) {
    return 'unknown';
  }

  context.componentInProgress.add(cacheKey);

  let classification: ComponentAncestorClassification;
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
): ComponentAncestorClassification {
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
): ComponentAncestorClassification {
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

// Classify direct `children` insertion points; other forms stay unknown.
function analyzeFunctionComponent(
  path: NodePath<t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression>,
  context: AncestorAnalysisContext
): ComponentAncestorClassification {
  const references = getChildrenReferences(path);
  if (!references) return 'unknown';
  if (references.length === 0) return 'safe';

  let classification = classifyChildrenReference(references[0]!, path, context);
  for (const reference of references.slice(1)) {
    classification = mergeChildrenClassifications(classification, classifyChildrenReference(reference, path, context));
  }
  return classification;
}

function getChildrenReferences(
  path: NodePath<t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression>
): NodePath<t.Node>[] | undefined {
  const parameter = path.node.params[0];
  if (!parameter) return [];

  if (t.isIdentifier(parameter)) {
    const binding = path.scope.getBinding(parameter.name);
    if (!binding) return;

    const references: NodePath<t.Node>[] = [];
    for (const reference of binding.referencePaths) {
      const parent = reference.parentPath;
      if (!parent?.isMemberExpression() && !parent?.isOptionalMemberExpression()) return;
      if (parent.node.object !== reference.node) return;
      if (isChildrenProperty(parent.node)) references.push(parent);
      else if (parent.node.computed) return;
    }
    return references;
  }

  if (!t.isObjectPattern(parameter)) return;
  const property = parameter.properties.find(
    (item): item is t.ObjectProperty =>
      t.isObjectProperty(item) &&
      !item.computed &&
      (t.isIdentifier(item.key, { name: 'children' }) || t.isStringLiteral(item.key, { value: 'children' }))
  );
  if (!property) {
    return parameter.properties.some((item) => t.isRestElement(item) || (t.isObjectProperty(item) && item.computed))
      ? undefined
      : [];
  }

  const value = t.isAssignmentPattern(property.value) ? property.value.left : property.value;
  if (!t.isIdentifier(value)) return;
  return path.scope.getBinding(value.name)?.referencePaths;
}

function isChildrenProperty(expression: t.MemberExpression | t.OptionalMemberExpression): boolean {
  return expression.computed
    ? t.isStringLiteral(expression.property, { value: 'children' })
    : t.isIdentifier(expression.property, { name: 'children' });
}

function classifyChildrenReference(
  reference: NodePath<t.Node>,
  component: NodePath<t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression>,
  context: AncestorAnalysisContext
): ComponentAncestorClassification {
  if (reference.parentPath?.isReturnStatement() && reference.key === 'argument') return 'transparent';

  const container = reference.parentPath;
  if (!container?.isJSXExpressionContainer() || reference.key !== 'expression') return 'unknown';

  let jsxPath = container.parentPath;
  if (jsxPath?.isJSXAttribute()) {
    if (!t.isJSXIdentifier(jsxPath.node.name, { name: 'children' })) return 'unknown';
    const elementPath = jsxPath.parentPath?.parentPath;
    if (!elementPath) return 'unknown';
    jsxPath = elementPath;
  }
  if (!jsxPath?.isJSXElement() && !jsxPath?.isJSXFragment()) return 'unknown';

  while (jsxPath.isJSXElement() || jsxPath.isJSXFragment()) {
    if (jsxPath.isJSXElement()) {
      const classification = classifyJSXElementAsAncestor(jsxPath, context);
      if (classification !== 'transparent') return classification;
    }

    const parent = jsxPath.parentPath;
    if (parent?.isJSXElement() || parent?.isJSXFragment()) {
      if (jsxPath.listKey !== 'children') return 'unknown';
      jsxPath = parent;
      continue;
    }
    if (parent?.node === component.node) return 'transparent';
    if (parent?.isReturnStatement() && jsxPath.key === 'argument') {
      return parent.getFunctionParent()?.node === component.node ? 'transparent' : 'unknown';
    }
    return 'unknown';
  }

  return 'unknown';
}

function mergeChildrenClassifications(
  current: ComponentAncestorClassification,
  next: ComponentAncestorClassification
): ComponentAncestorClassification {
  if (current === 'text' || next === 'text') return 'text';
  return current === next ? current : 'unknown';
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
