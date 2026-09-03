import type { JSXOptimizer, OptimizationName, Optimizer, OptimizerContext, OptimizationState } from '../types';

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
        optimize(path, state.optimizerContext);
      },
    },
  };
}
