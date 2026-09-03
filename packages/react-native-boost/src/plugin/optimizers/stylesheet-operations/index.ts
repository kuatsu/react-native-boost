import { NodePath, types as t } from '@babel/core';
import type { Optimizer } from '../../types';
import { isForcedLine, isIgnoredLine, isStaticLiteralTree, tryFlattenStaticStyle } from '../../utils/common';

type StyleSheetOperation = 'compose' | 'flatten';

export const stylesheetOperationsOptimizer: Optimizer = {
  name: 'stylesheet-operations',
  visitor: {
    CallExpression(path, state) {
      if (!state.enabledOptimizations.has('stylesheet-operations')) return;

      const operation = getStyleSheetOperation(path);
      if (!operation) return;

      const { logger, platform } = state.optimizerContext;
      const target = `StyleSheet.${operation}`;
      if (platform !== 'ios' && platform !== 'android') {
        logger.skipped({ target, path, reason: 'target platform is unknown' });
        return;
      }

      const forced = isForcedLine(path);
      if (!forced && isIgnoredLine(path)) {
        logger.skipped({ target, path, reason: 'line is marked with @boost-ignore' });
        return;
      }

      const staticReplacement = buildStaticReplacement(path, operation);
      const replacement = staticReplacement ?? (forced ? buildForcedReplacement(path, operation) : undefined);
      if (!replacement) {
        const reason = forced ? 'call has unsupported arguments' : 'result cannot be resolved at build time';
        logger.skipped({ target, path, reason });
        return;
      }
      if (forced && !staticReplacement) {
        logger.forced({ target, path, reason: 'result cannot be resolved at build time' });
      }

      const result = t.sequenceExpression([t.cloneNode(path.node.callee as t.MemberExpression, true), replacement]);
      t.inheritsComments(result, path.node);
      logger.optimized({ target, path });
      path.replaceWith(result);
    },
  },
};

function getStyleSheetOperation(path: NodePath<t.CallExpression>): StyleSheetOperation | undefined {
  const callee = path.node.callee;
  if (
    !t.isMemberExpression(callee) ||
    callee.computed ||
    !t.isIdentifier(callee.object) ||
    !t.isIdentifier(callee.property) ||
    (callee.property.name !== 'compose' && callee.property.name !== 'flatten')
  ) {
    return;
  }

  const binding = path.scope.getBinding(callee.object.name);
  if (
    binding?.kind !== 'module' ||
    !t.isImportSpecifier(binding.path.node) ||
    !t.isIdentifier(binding.path.node.imported, { name: 'StyleSheet' }) ||
    !t.isImportDeclaration(binding.path.parent) ||
    binding.path.parent.source.value !== 'react-native'
  ) {
    return;
  }

  return callee.property.name;
}

function buildStaticReplacement(
  path: NodePath<t.CallExpression>,
  operation: StyleSheetOperation
): t.Expression | undefined {
  const arguments_ = path.node.arguments;
  if (operation === 'flatten') {
    if (arguments_.length !== 1 || !t.isExpression(arguments_[0])) return;
    return buildStaticFlatten(path, arguments_[0]);
  }

  if (arguments_.length !== 2 || !t.isExpression(arguments_[0]) || !t.isExpression(arguments_[1])) return;
  const [first, second] = arguments_;
  if (isStaticNullish(path, first)) return t.cloneNode(second, true);
  if (isStaticNullish(path, second)) return t.cloneNode(first, true);
  if (isStaticNonNullish(first) && isStaticNonNullish(second)) {
    return t.arrayExpression([t.cloneNode(first, true), t.cloneNode(second, true)]);
  }
}

function buildStaticFlatten(path: NodePath<t.CallExpression>, expression: t.Expression): t.Expression | undefined {
  const flattened = tryFlattenStaticStyle(expression, path.scope.getBinding('undefined') === undefined);
  if (flattened) {
    return t.objectExpression(
      [...flattened].map(([name, value]) =>
        t.objectProperty(t.isValidIdentifier(name, false) ? t.identifier(name) : t.stringLiteral(name), value)
      )
    );
  }

  if (isStaticNullish(path, expression) || isStaticNonObjectLiteral(expression)) {
    return t.unaryExpression('void', t.numericLiteral(0));
  }
}

function buildForcedReplacement(
  path: NodePath<t.CallExpression>,
  operation: StyleSheetOperation
): t.Expression | undefined {
  const arguments_ = path.node.arguments;
  if (operation === 'flatten') {
    return arguments_.length === 1 && t.isExpression(arguments_[0]) ? t.cloneNode(arguments_[0], true) : undefined;
  }
  if (arguments_.length !== 2 || !t.isExpression(arguments_[0]) || !t.isExpression(arguments_[1])) return;
  return t.arrayExpression([t.cloneNode(arguments_[0], true), t.cloneNode(arguments_[1], true)]);
}

function isStaticNullish(path: NodePath, expression: t.Expression): boolean {
  return (
    t.isNullLiteral(expression) ||
    (t.isIdentifier(expression, { name: 'undefined' }) && path.scope.getBinding('undefined') === undefined) ||
    (t.isUnaryExpression(expression, { operator: 'void' }) && t.isNumericLiteral(expression.argument))
  );
}

function isStaticNonNullish(expression: t.Expression): boolean {
  return !t.isNullLiteral(expression) && isStaticLiteralTree(expression);
}

function isStaticNonObjectLiteral(expression: t.Expression): boolean {
  return isStaticNonNullish(expression) && !t.isObjectExpression(expression) && !t.isArrayExpression(expression);
}
