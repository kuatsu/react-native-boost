import { NodePath, types as t } from '@babel/core';
import type { Optimizer, OptimizerState, TargetPlatform } from '../../types';
import { isIgnoredLine, isStaticLiteralTree } from '../../utils/common';

const platformFoldingVisitor = {
  CallExpression(path: NodePath<t.CallExpression>, state: OptimizerState) {
    if (!isPlatformSelect(path)) return;

    const { logger, platform } = state.optimizerContext;
    if (!platform) {
      logger.skipped({ target: 'Platform.select', path, reason: 'target platform is unknown' });
      return;
    }
    if (isIgnoredLine(path)) return;

    const replacement = buildSelectReplacement(path, platform);
    if (!replacement) {
      logger.skipped({ target: 'Platform.select', path, reason: 'select spec is not a plain object literal' });
      return;
    }

    t.inheritsComments(replacement, path.node);
    path.replaceWith(replacement);
    logger.optimized({ target: 'Platform.select', path });
  },
  ConditionalExpression(path: NodePath<t.ConditionalExpression>, state: OptimizerState) {
    const comparison = getPlatformComparison(path);
    if (!comparison) return;

    const { logger, platform } = state.optimizerContext;
    if (!platform) {
      logger.skipped({ target: 'Platform.OS', path, reason: 'target platform is unknown' });
      return;
    }
    if (isIgnoredLine(path)) return;

    const matches = comparison.value === platform;
    const replacement = t.cloneNode(
      matches === (comparison.operator === '===') ? path.node.consequent : path.node.alternate,
      true
    );
    t.inheritsComments(replacement, path.node);
    path.replaceWith(replacement);
    logger.optimized({ target: 'Platform.OS', path });
  },
};

export const platformFoldingOptimizer: Optimizer = {
  name: 'platform-folding',
  visitor: {
    Program(path, state) {
      if (!state.enabledOptimizations.has('platform-folding')) return;
      // Fold before JSXOpeningElement optimizers inspect their attributes and children.
      path.traverse(platformFoldingVisitor, state);
    },
  },
};

function isPlatformSelect(path: NodePath<t.CallExpression>): boolean {
  const callee = path.node.callee;
  return (
    t.isMemberExpression(callee) &&
    !callee.computed &&
    t.isIdentifier(callee.property, { name: 'select' }) &&
    isPlatformReference(path, callee.object)
  );
}

function getPlatformComparison(
  path: NodePath<t.ConditionalExpression>
): { operator: '===' | '!=='; value: string } | undefined {
  const test = path.node.test;
  if (!t.isBinaryExpression(test) || (test.operator !== '===' && test.operator !== '!==')) return;

  if (isPlatformOSReference(path, test.left) && t.isStringLiteral(test.right)) {
    return { operator: test.operator, value: test.right.value };
  }
  if (isPlatformOSReference(path, test.right) && t.isStringLiteral(test.left)) {
    return { operator: test.operator, value: test.left.value };
  }
}

function buildSelectReplacement(path: NodePath<t.CallExpression>, platform: TargetPlatform): t.Expression | undefined {
  const [argument] = path.node.arguments;
  if (path.node.arguments.length !== 1 || !t.isObjectExpression(argument)) return;

  const properties = new Map<string, t.ObjectProperty>();
  for (const property of argument.properties) {
    if (!t.isObjectProperty(property) || property.computed) return;

    const name = getStaticPropertyName(property.key);
    if (name === '__proto__') return;
    if (name !== undefined) properties.set(name, property);
  }

  const selected = properties.get(platform) ?? properties.get('native') ?? properties.get('default');
  const hasUnsafeDiscardedValue = argument.properties.some(
    (property) => property !== selected && t.isObjectProperty(property) && !isStaticLiteralTree(property.value)
  );
  if (hasUnsafeDiscardedValue) {
    const property = t.stringLiteral(selected ? getStaticPropertyName(selected.key)! : platform);
    return t.memberExpression(t.cloneNode(argument, true), property, true);
  }
  if (selected) return t.cloneNode(selected.value, true) as t.Expression;
  return t.unaryExpression('void', t.numericLiteral(0));
}

function isPlatformOSReference(path: NodePath, expression: t.Node): boolean {
  return (
    t.isMemberExpression(expression) &&
    !expression.computed &&
    t.isIdentifier(expression.property, { name: 'OS' }) &&
    isPlatformReference(path, expression.object)
  );
}

function isPlatformReference(path: NodePath, expression: t.Node): boolean {
  if (t.isIdentifier(expression)) {
    const binding = path.scope.getBinding(expression.name);
    return isReactNativeImport(binding, t.isImportSpecifier, 'Platform');
  }

  if (
    !t.isMemberExpression(expression) ||
    expression.computed ||
    !t.isIdentifier(expression.object) ||
    !t.isIdentifier(expression.property, { name: 'Platform' })
  ) {
    return false;
  }

  const binding = path.scope.getBinding(expression.object.name);
  return isReactNativeImport(binding, t.isImportNamespaceSpecifier);
}

function isReactNativeImport(
  binding: ReturnType<NodePath['scope']['getBinding']>,
  isSpecifier: (node: t.Node) => boolean,
  importedName?: string
): boolean {
  if (!binding || binding.kind !== 'module' || !isSpecifier(binding.path.node)) return false;
  if (!t.isImportDeclaration(binding.path.parent) || binding.path.parent.source.value !== 'react-native') return false;
  if (binding.path.parent.importKind === 'type') return false;
  if (t.isImportSpecifier(binding.path.node)) {
    if (binding.path.node.importKind === 'type') return false;
    return importedName === undefined || t.isIdentifier(binding.path.node.imported, { name: importedName });
  }
  return importedName === undefined;
}

function getStaticPropertyName(key: t.Node): string | undefined {
  if (t.isIdentifier(key)) return key.name;
  if (t.isStringLiteral(key)) return key.value;
  return;
}
