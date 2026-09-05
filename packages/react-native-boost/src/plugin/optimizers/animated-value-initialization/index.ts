import { NodePath, types as t } from '@babel/core';
import type { HubFile, Optimizer } from '../../types';
import PluginError from '../../utils/plugin-error';
import { addFileImportHint, isIgnoredLine, isModuleImportBinding, isStaticLiteralTree } from '../../utils/common';

type AnimatedConstructor = 'Color' | 'Value' | 'ValueXY';
type ReactHook = 'useRef' | 'useState';

const HOOK_BY_CONSTRUCTOR: Record<AnimatedConstructor, string> = {
  Color: 'useAnimatedColor',
  Value: 'useAnimatedValue',
  ValueXY: 'useAnimatedValueXY',
};

export const animatedValueInitializationOptimizer: Optimizer = {
  name: 'animated-value-initialization',
  defaultState: ({ reactNativeMinor }) => (reactNativeMinor !== undefined && reactNativeMinor >= 83 ? 'on' : 'off'),
  visitor: {
    MemberExpression(path, state) {
      if (!state.enabledOptimizations.has('animated-value-initialization')) return;
      if (path.node.computed || !t.isIdentifier(path.node.property, { name: 'current' }) || !path.isReferenced())
        return;

      const call = path.node.object;
      if (!t.isCallExpression(call) || !isReactHook(path, call.callee, 'useRef') || call.arguments.length !== 1) return;

      const constructor = getAnimatedConstructor(path, call.arguments[0]);
      if (!constructor) return;

      const { logger, platform, reactNativeMinor } = state.optimizerContext;
      const target = `Animated.${constructor.name}`;
      if (platform !== 'ios' && platform !== 'android') {
        logger.skipped({ target, path, reason: 'target platform is unknown' });
        return;
      }
      if (!supportsHook(constructor.name, reactNativeMinor)) {
        logger.skipped({ target, path, reason: 'React Native version does not export the matching hook' });
        return;
      }
      if (isIgnoredLine(path)) return;

      const file = (path.hub as unknown as { file?: HubFile }).file;
      if (!file) throw new PluginError('No file found in Babel hub');

      const hookName = HOOK_BY_CONSTRUCTOR[constructor.name];
      const hook = addFileImportHint({
        file,
        nameHint: hookName,
        path,
        importName: hookName,
        moduleName:
          state.optimizerContext.options?.integrations?.uniwind === 'on'
            ? 'react-native-boost/uniwind'
            : 'react-native',
      });
      const replacement = t.callExpression(
        hook,
        constructor.expression.arguments.map((argument) => t.cloneNode(argument, true))
      );
      t.inheritsComments(replacement, path.node);
      path.replaceWith(replacement);
      logger.optimized({ target, path });
    },
    CallExpression(path, state) {
      if (!state.enabledOptimizations.has('animated-value-initialization')) return;
      if (!isReactHook(path, path.node.callee, 'useState') || path.node.arguments.length !== 1) return;

      const constructor = getAnimatedConstructor(path, path.node.arguments[0]);
      if (!constructor || isIgnoredLine(path)) return;

      const { logger, platform } = state.optimizerContext;
      const target = `Animated.${constructor.name}`;
      if (platform !== 'ios' && platform !== 'android') {
        logger.skipped({ target, path, reason: 'target platform is unknown' });
        return;
      }

      const initializer = t.arrowFunctionExpression([], t.cloneNode(constructor.expression, true));
      t.inheritsComments(initializer, constructor.expression);
      path.node.arguments[0] = initializer;
      logger.optimized({ target, path });
    },
  },
};

function getAnimatedConstructor(
  path: NodePath,
  node: t.Node | null | undefined
): { expression: t.NewExpression; name: AnimatedConstructor } | undefined {
  if (
    !t.isNewExpression(node) ||
    !t.isMemberExpression(node.callee) ||
    node.callee.computed ||
    !t.isIdentifier(node.callee.property) ||
    !isAnimatedReference(path, node.callee.object)
  ) {
    return;
  }

  const name = node.callee.property.name;
  if (!isAnimatedConstructor(name) || !hasStaticArguments(node, name)) return;
  return { expression: node, name };
}

function isAnimatedConstructor(name: string): name is AnimatedConstructor {
  return name === 'Value' || name === 'ValueXY' || name === 'Color';
}

function hasStaticArguments(expression: t.NewExpression, constructor: AnimatedConstructor): boolean {
  const arguments_ = expression.arguments;
  if (arguments_.length > 2 || arguments_.some((argument) => !t.isExpression(argument))) return false;
  if (arguments_[1] && !isStaticConfig(arguments_[1] as t.Expression)) return false;

  const initialValue = arguments_[0] as t.Expression | undefined;
  if (constructor === 'Value') return initialValue !== undefined && isStaticNumber(initialValue);
  if (constructor === 'ValueXY') return initialValue === undefined || isStaticValueXY(initialValue);
  return initialValue === undefined || isStaticLiteralTree(initialValue);
}

function isStaticConfig(expression: t.Expression): boolean {
  return t.isNullLiteral(expression) || (t.isObjectExpression(expression) && isStaticLiteralTree(expression));
}

function isStaticNumber(expression: t.Expression): boolean {
  return (
    t.isNumericLiteral(expression) ||
    (t.isUnaryExpression(expression, { operator: '-' }) && t.isNumericLiteral(expression.argument))
  );
}

function isStaticValueXY(expression: t.Expression): boolean {
  if (!t.isObjectExpression(expression) || !isStaticLiteralTree(expression)) return false;

  let x: t.Expression | undefined;
  let y: t.Expression | undefined;
  for (const property of expression.properties) {
    if (!t.isObjectProperty(property) || !t.isExpression(property.value)) return false;
    const name = t.isIdentifier(property.key) ? property.key.name : (property.key as t.StringLiteral).value;
    if (name === 'x') x = property.value;
    if (name === 'y') y = property.value;
  }
  return x !== undefined && y !== undefined && isStaticNumber(x) && isStaticNumber(y);
}

function supportsHook(constructor: AnimatedConstructor, reactNativeMinor?: number): boolean {
  return reactNativeMinor !== undefined && reactNativeMinor >= (constructor === 'Value' ? 83 : 85);
}

function isReactHook(path: NodePath, expression: t.Node, hook: ReactHook): boolean {
  if (t.isIdentifier(expression)) {
    const binding = path.scope.getBinding(expression.name);
    return isModuleImportBinding(binding, 'react', t.isImportSpecifier, hook);
  }

  if (
    !t.isMemberExpression(expression) ||
    expression.computed ||
    !t.isIdentifier(expression.object) ||
    !t.isIdentifier(expression.property, { name: hook })
  ) {
    return false;
  }

  const binding = path.scope.getBinding(expression.object.name);
  return isModuleImportBinding(
    binding,
    'react',
    (node) => t.isImportDefaultSpecifier(node) || t.isImportNamespaceSpecifier(node)
  );
}

function isAnimatedReference(path: NodePath, expression: t.Node): boolean {
  if (t.isIdentifier(expression)) {
    const binding = path.scope.getBinding(expression.name);
    return isModuleImportBinding(binding, 'react-native', t.isImportSpecifier, 'Animated');
  }

  if (
    !t.isMemberExpression(expression) ||
    expression.computed ||
    !t.isIdentifier(expression.object) ||
    !t.isIdentifier(expression.property, { name: 'Animated' })
  ) {
    return false;
  }

  const binding = path.scope.getBinding(expression.object.name);
  return isModuleImportBinding(binding, 'react-native', t.isImportNamespaceSpecifier);
}
