import type { JSXOptimizer, OptimizationName, Optimizer, OptimizerContext, OptimizationState } from '../types';
import { isIgnoredLine, isReactNativeComponent } from './common/validation';
import { openLiteralSpreads } from './literal-spreads';

const spreadComponents: Partial<Record<OptimizationName, string>> = {
  'native-text': 'Text',
  'native-view': 'View',
  'native-image': 'Image',
  'native-activity-indicator': 'ActivityIndicator',
};

export function createJSXOptimizer(
  name: OptimizationName,
  optimize: JSXOptimizer,
  defaultState?: OptimizationState | ((context: OptimizerContext) => OptimizationState)
): Optimizer {
  return {
    name,
    defaultState,
    visitor: {
      JSXOpeningElement(path, state) {
        if (!state.enabledOptimizations.has(name)) return;
        const component = spreadComponents[name];
        if (!component || !isReactNativeComponent(path, component) || isIgnoredLine(path)) {
          optimize(path, state.optimizerContext);
          return;
        }
        const originalAttributes = path.node.attributes;
        const originalElement = path.parentPath.node;
        const originalTag = 'name' in path.node.name ? path.node.name.name : undefined;
        const { platform } = state.optimizerContext;
        if (platform === 'ios' || platform === 'android') openLiteralSpreads(path);
        optimize(path, state.optimizerContext);
        // Restore rejected sites, including in the pre-Compiler pass; its disabled set prevents a retry.
        if (
          path.parentPath.node === originalElement &&
          'name' in path.node.name &&
          path.node.name.name === originalTag
        ) {
          path.node.attributes = originalAttributes;
        }
      },
    },
  };
}
