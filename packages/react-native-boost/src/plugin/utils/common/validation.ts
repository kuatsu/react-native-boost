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

type AncestorClassification = 'safe' | 'text' | 'unknown';
export type ViewAncestorClassification = AncestorClassification;
type ScopeBinding = NonNullable<ReturnType<NodePath<t.Node>['scope']['getBinding']>>;

type AncestorAnalysisContext = {
  componentCache: WeakMap<t.Node, AncestorClassification>;
  componentInProgress: WeakSet<t.Node>;
  renderExpressionInProgress: WeakSet<t.Node>;
};

export const getViewAncestorClassification = (path: NodePath<t.JSXOpeningElement>): ViewAncestorClassification => {
  return classifyViewAncestors(path);
};

function classifyViewAncestors(path: NodePath<t.JSXOpeningElement>): AncestorClassification {
  const context: AncestorAnalysisContext = {
    componentCache: new WeakMap<t.Node, AncestorClassification>(),
    componentInProgress: new WeakSet<t.Node>(),
    renderExpressionInProgress: new WeakSet<t.Node>(),
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
}

function classifyJSXElementAsAncestor(
  path: NodePath<t.JSXElement>,
  context: AncestorAnalysisContext
): AncestorClassification {
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
    return classifyModuleBindingAsAncestor(binding);
  }

  return classifyLocalBindingAsAncestor(binding, context);
}

function classifyModuleBindingAsAncestor(binding: ScopeBinding): AncestorClassification {
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

  if (source === 'react' && t.isImportSpecifier(binding.path.node)) {
    const importedName = getImportSpecifierImportedName(binding.path.node);
    if (importedName === 'Fragment') return 'safe';
  }

  return 'unknown';
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
