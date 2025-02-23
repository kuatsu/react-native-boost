import { NodePath, types as t } from '@babel/core';

export interface PluginOptions {
  optimizations?: {
    text?: boolean;
  };
}

export type Optimizer = (path: NodePath<t.JSXOpeningElement>) => void;
