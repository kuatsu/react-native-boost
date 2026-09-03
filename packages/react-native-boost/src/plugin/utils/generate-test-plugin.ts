import type { PluginObj } from '@babel/core';
import { declare } from '@babel/helper-plugin-utils';
import type { BoostOptions, Optimizer, OptimizerState, TargetPlatform } from '../types';
import { createLogger } from './logger';

export const generateTestPlugin = (
  optimizer: Optimizer,
  options: BoostOptions = {},
  platform?: TargetPlatform,
  reactNativeMinor?: number
) => {
  const logger = createLogger('silent');

  return declare((api) => {
    api.assertVersion(7);

    const plugin: PluginObj<OptimizerState> = {
      name: 'react-native-boost',
      pre() {
        this.enabledOptimizations = new Set([optimizer.name]);
        this.optimizerContext = {
          logger,
          options,
          platform,
          unistylesEnabled: options.integrations?.unistyles === 'on',
          reactNativeMinor,
        };
      },
      visitor: optimizer.visitor,
    };
    return plugin as unknown as PluginObj;
  });
};
