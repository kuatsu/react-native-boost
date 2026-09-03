import { NodePath, types as t } from '@babel/core';
import type { HubFile, OptimizableComponent, Optimizer } from '../../types';
import PluginError from '../../utils/plugin-error';
import { getFirstBailoutReason } from '../../utils/helpers';
import {
  addFileImportHint,
  isForcedLine,
  isIgnoredLine,
  isStaticLiteralTree,
  makeAttribute,
  markReactNativeComponent,
  tryFlattenStaticStyle,
} from '../../utils/common';

type AnimatedComponent = 'Image' | 'ScrollView' | 'Text' | 'View';

const COMPONENTS = new Set<AnimatedComponent>(['Image', 'ScrollView', 'Text', 'View']);
const REF_PROPS = new Set(['innerViewRef', 'ref', 'scrollViewRef']);

export const staticAnimatedOptimizer: Optimizer = (path, { logger, platform }) => {
  const component = getAnimatedComponent(path);
  if (!component) return;

  const logComponent: OptimizableComponent = `Animated.${component}`;
  if (platform !== 'ios' && platform !== 'android') {
    logger.skipped({ component: logComponent, path, reason: 'target platform is unknown' });
    return;
  }

  const forced = isForcedLine(path);
  const style = buildStaticStyle(path);
  const bailoutChecks = [
    {
      reason: 'has spread props',
      shouldBail: () => path.node.attributes.some((attribute) => t.isJSXSpreadAttribute(attribute)),
    },
    {
      reason: 'has props that require the Animated wrapper',
      shouldBail: () => hasUnsupportedAttribute(path, component),
    },
    {
      reason: 'has children that may contain an Animated value',
      shouldBail: () => !hasStaticChildren(path.parent as t.JSXElement, path),
    },
    { reason: 'has a dynamic style', shouldBail: () => style === undefined },
  ];

  const overriddenReason = forced ? getFirstBailoutReason(bailoutChecks) : undefined;
  if (forced) {
    if (overriddenReason) logger.forced({ component: logComponent, path, reason: overriddenReason });
  } else {
    const skipReason = getFirstBailoutReason([
      { reason: 'line is marked with @boost-ignore', shouldBail: () => isIgnoredLine(path) },
      ...bailoutChecks,
    ]);
    if (skipReason) {
      logger.skipped({ component: logComponent, path, reason: skipReason });
      return;
    }
  }

  const file = (path.hub as unknown as { file?: HubFile }).file;
  if (!file) throw new PluginError('No file found in Babel hub');

  const replacement = addFileImportHint({
    file,
    nameHint: `StaticAnimated${component}`,
    path,
    importName: component,
    moduleName: 'react-native',
  });

  const preserveAuthoredStyle = overriddenReason !== undefined;
  const attributes = path.node.attributes.filter(
    (attribute) =>
      !t.isJSXAttribute(attribute) ||
      !t.isJSXIdentifier(attribute.name) ||
      (attribute.name.name !== 'collapsable' && (preserveAuthoredStyle || attribute.name.name !== 'style'))
  );

  if (
    component === 'ScrollView' &&
    !attributes.some(
      (attribute) => t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name, { name: 'scrollEventThrottle' })
    )
  ) {
    attributes.push(makeAttribute('scrollEventThrottle', t.numericLiteral(0.0001)));
  }

  // Native Animated cannot target flattened views, so its wrapper always forces this value.
  attributes.push(makeAttribute('collapsable', t.booleanLiteral(false)));
  if (!preserveAuthoredStyle && style) attributes.push(makeAttribute('style', style));
  path.node.attributes = attributes;
  path.node.name = t.jsxIdentifier(replacement.name);

  const parent = path.parent as t.JSXElement;
  if (parent.closingElement) parent.closingElement.name = t.jsxIdentifier(replacement.name);

  markReactNativeComponent(path.node, component);
  logger.optimized({ component: logComponent, path });
};

function getAnimatedComponent(path: NodePath<t.JSXOpeningElement>): AnimatedComponent | undefined {
  const name = path.node.name;
  if (
    !t.isJSXMemberExpression(name) ||
    !t.isJSXIdentifier(name.object) ||
    !t.isJSXIdentifier(name.property) ||
    !COMPONENTS.has(name.property.name as AnimatedComponent)
  ) {
    return;
  }

  const binding = path.scope.getBinding(name.object.name);
  if (
    binding?.kind !== 'module' ||
    !t.isImportSpecifier(binding.path.node) ||
    !t.isIdentifier(binding.path.node.imported, { name: 'Animated' }) ||
    !t.isImportDeclaration(binding.path.parent) ||
    binding.path.parent.source.value !== 'react-native'
  ) {
    return;
  }

  return name.property.name as AnimatedComponent;
}

function hasUnsupportedAttribute(path: NodePath<t.JSXOpeningElement>, component: AnimatedComponent): boolean {
  const seen = new Set<string>();

  for (const attribute of path.node.attributes) {
    if (!t.isJSXAttribute(attribute) || !t.isJSXIdentifier(attribute.name)) return true;
    const name = attribute.name.name;
    if (seen.has(name)) return true;
    seen.add(name);

    if (REF_PROPS.has(name) || name === 'passthroughAnimatedPropExplicitValues') return true;
    if (component === 'ScrollView' && name === 'refreshControl') return true;
    if (name === 'key' || name === 'style') continue;
    if (name === 'collapsable') {
      if (!isStaticAttribute(attribute)) return true;
      continue;
    }
    if (!isStaticAttribute(attribute) && !isFunctionAttribute(path, attribute)) return true;
  }

  return false;
}

function isStaticAttribute(attribute: t.JSXAttribute): boolean {
  if (!attribute.value || t.isStringLiteral(attribute.value)) return true;
  if (!t.isJSXExpressionContainer(attribute.value)) return false;
  const expression = attribute.value.expression;
  return t.isJSXEmptyExpression(expression) || (t.isExpression(expression) && isStaticLiteralTree(expression));
}

function isFunctionAttribute(path: NodePath<t.JSXOpeningElement>, attribute: t.JSXAttribute): boolean {
  if (!t.isJSXExpressionContainer(attribute.value) || !t.isExpression(attribute.value.expression)) return false;
  const expression = attribute.value.expression;
  if (t.isArrowFunctionExpression(expression) || t.isFunctionExpression(expression)) return true;
  return t.isIdentifier(expression) && isFunctionIdentifier(path, expression.name);
}

function hasStaticChildren(parent: t.JSXElement, path: NodePath<t.JSXOpeningElement>): boolean {
  return parent.children.every((child) => {
    if (t.isJSXText(child) || t.isJSXElement(child) || t.isJSXFragment(child)) return true;
    if (!t.isJSXExpressionContainer(child)) return false;
    if (t.isJSXEmptyExpression(child.expression)) return true;
    if (t.isJSXElement(child.expression) || t.isJSXFragment(child.expression)) return true;
    return (
      t.isExpression(child.expression) &&
      (isStaticLiteralTree(child.expression) ||
        t.isArrowFunctionExpression(child.expression) ||
        t.isFunctionExpression(child.expression) ||
        (t.isIdentifier(child.expression) && isFunctionIdentifier(path, child.expression.name)))
    );
  });
}

function isFunctionIdentifier(path: NodePath<t.JSXOpeningElement>, name: string): boolean {
  const binding = path.scope.getBinding(name);
  if (binding?.path.isFunctionDeclaration()) return true;
  return (
    binding?.constant === true &&
    binding.path.isVariableDeclarator() &&
    (t.isArrowFunctionExpression(binding.path.node.init) || t.isFunctionExpression(binding.path.node.init))
  );
}

function buildStaticStyle(path: NodePath<t.JSXOpeningElement>): t.Expression | undefined {
  const attribute = path.node.attributes.find(
    (candidate): candidate is t.JSXAttribute =>
      t.isJSXAttribute(candidate) && t.isJSXIdentifier(candidate.name, { name: 'style' })
  );
  if (!attribute?.value || t.isStringLiteral(attribute.value)) return t.identifier('undefined');
  if (!t.isJSXExpressionContainer(attribute.value) || t.isJSXEmptyExpression(attribute.value.expression)) {
    return t.identifier('undefined');
  }

  const expression = attribute.value.expression;
  if (t.isObjectExpression(expression) || t.isArrayExpression(expression)) {
    const flattened = tryFlattenStaticStyle(expression, false);
    if (!flattened) return undefined;
    return t.objectExpression(
      [...flattened].map(([name, value]) =>
        t.objectProperty(t.isValidIdentifier(name, false) ? t.identifier(name) : t.stringLiteral(name), value)
      )
    );
  }
  if (isStaticLiteralTree(expression)) return t.identifier('undefined');
  if (t.isIdentifier(expression, { name: 'undefined' }) && !path.scope.getBinding('undefined')) {
    return t.identifier('undefined');
  }
  return undefined;
}
