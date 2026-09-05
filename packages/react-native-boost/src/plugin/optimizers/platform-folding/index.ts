import { NodePath, types as t } from '@babel/core';
import type { Optimizer, OptimizerState, TargetPlatform } from '../../types';
import { isIgnoredLine, isModuleImportBinding, isStaticLiteralTree } from '../../utils/common';

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
  IfStatement(path: NodePath<t.IfStatement>, state: OptimizerState) {
    const comparison = getPlatformComparison(path, path.node.test);
    if (!comparison) return;

    const platform = getTargetPlatform(path, state);
    if (!platform) return;

    const matches = platformMatches(comparison, platform);
    const branch = path.get(matches ? 'consequent' : 'alternate');
    const discarded = path.get(matches ? 'alternate' : 'consequent');
    if (discarded.node && hasHoistedDeclaration(discarded as NodePath<t.Statement>)) {
      path.skip();
      return;
    }

    state.optimizerContext.logger.optimized({ target: 'Platform.OS', path });
    if (branch.node) {
      const replacement = t.cloneNode(branch.node, true);
      t.inheritsComments(replacement, path.node);
      path.replaceWith(replacement);
    } else {
      path.remove();
    }
  },
  LogicalExpression(path: NodePath<t.LogicalExpression>, state: OptimizerState) {
    if (path.node.operator !== '&&' && path.node.operator !== '||') return;
    const comparison = getPlatformComparison(path, path.node.left);
    if (!comparison) return;

    const platform = getTargetPlatform(path, state);
    if (!platform) return;

    const left = platformMatches(comparison, platform);
    const replacement = (path.node.operator === '&&' ? left : !left)
      ? t.cloneNode(path.node.right, true)
      : t.booleanLiteral(left);
    t.inheritsComments(replacement, path.node);
    state.optimizerContext.logger.optimized({ target: 'Platform.OS', path });
    path.replaceWith(replacement);
  },
  ConditionalExpression(path: NodePath<t.ConditionalExpression>, state: OptimizerState) {
    const comparison = getPlatformComparison(path, path.node.test);
    if (!comparison) return;

    const platform = getTargetPlatform(path, state);
    if (!platform) return;

    const replacement = t.cloneNode(
      platformMatches(comparison, platform) ? path.node.consequent : path.node.alternate,
      true
    );
    t.inheritsComments(replacement, path.node);
    state.optimizerContext.logger.optimized({ target: 'Platform.OS', path });
    path.replaceWith(replacement);
  },
  BinaryExpression(path: NodePath<t.BinaryExpression>, state: OptimizerState) {
    const comparison = getPlatformComparison(path, path.node);
    if (!comparison) return;

    const platform = getTargetPlatform(path, state);
    if (!platform) return;

    state.optimizerContext.logger.optimized({ target: 'Platform.OS', path });
    path.replaceWith(t.booleanLiteral(platformMatches(comparison, platform)));
  },
  MemberExpression(path: NodePath<t.MemberExpression>, state: OptimizerState) {
    if (!isPlatformOSReference(path, path.node) || !isReadOnly(path)) return;

    const platform = getTargetPlatform(path, state);
    if (!platform) return;

    state.optimizerContext.logger.optimized({ target: 'Platform.OS', path });
    path.replaceWith(t.stringLiteral(platform));
  },
};

export const platformFoldingOptimizer: Optimizer = {
  name: 'platform-folding',
  visitor: {
    Program(path, state) {
      if (!state.enabledOptimizations.has('platform-folding')) return;
      if (
        !Object.values(path.scope.bindings).some(
          (binding) =>
            isModuleImportBinding(binding, 'react-native', t.isImportSpecifier, 'Platform') ||
            isModuleImportBinding(binding, 'react-native', t.isImportNamespaceSpecifier)
        )
      )
        return;
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

type PlatformComparison = { operator: '===' | '!=='; value: string };

function getPlatformComparison(path: NodePath, expression: t.Node): PlatformComparison | undefined {
  if (!t.isBinaryExpression(expression) || (expression.operator !== '===' && expression.operator !== '!==')) return;

  if (isPlatformOSReference(path, expression.left) && t.isStringLiteral(expression.right)) {
    return { operator: expression.operator, value: expression.right.value };
  }
  if (isPlatformOSReference(path, expression.right) && t.isStringLiteral(expression.left)) {
    return { operator: expression.operator, value: expression.left.value };
  }
}

function platformMatches(comparison: PlatformComparison, platform: TargetPlatform): boolean {
  return (comparison.value === platform) === (comparison.operator === '===');
}

function getTargetPlatform(path: NodePath, state: OptimizerState): TargetPlatform | undefined {
  const { logger, platform } = state.optimizerContext;
  if (!platform) {
    logger.skipped({ target: 'Platform.OS', path, reason: 'target platform is unknown' });
    return;
  }
  if (!isIgnoredLine(path)) return platform;
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

function hasHoistedDeclaration(path: NodePath<t.Statement>): boolean {
  let found = t.isVariableDeclaration(path.node, { kind: 'var' }) || t.isFunctionDeclaration(path.node);
  path.traverse({
    Function(functionPath) {
      if (functionPath.isFunctionDeclaration()) found = true;
      functionPath.skip();
    },
    VariableDeclaration(variablePath) {
      if (variablePath.node.kind === 'var') found = true;
    },
  });
  return found;
}

function isReadOnly(path: NodePath<t.MemberExpression>): boolean {
  const parent = path.parent;
  if (!path.isReferenced()) return false;
  if (path.key === 'value' && t.isObjectProperty(parent) && t.isObjectPattern(path.parentPath.parent)) return false;
  if (t.isUpdateExpression(parent) || (t.isUnaryExpression(parent) && parent.operator === 'delete')) return false;
  if ((t.isForInStatement(parent) || t.isForOfStatement(parent)) && parent.left === path.node) return false;
  return true;
}

function isPlatformReference(path: NodePath, expression: t.Node): boolean {
  if (t.isIdentifier(expression)) {
    const binding = path.scope.getBinding(expression.name);
    return isModuleImportBinding(binding, 'react-native', t.isImportSpecifier, 'Platform');
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
  return isModuleImportBinding(binding, 'react-native', t.isImportNamespaceSpecifier);
}

function getStaticPropertyName(key: t.Node): string | undefined {
  if (t.isIdentifier(key)) return key.name;
  if (t.isStringLiteral(key)) return key.value;
  return;
}
