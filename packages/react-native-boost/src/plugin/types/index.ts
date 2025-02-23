import { NodePath, types as t } from '@babel/core';

export interface PluginOptions {
  /**
   * Whether or not to log optimized files to the console.
   * @default false
   */
  verbose?: boolean;
  /**
   * The optimizations to apply to the plugin.
   */
  optimizations?: {
    /**
     * Whether or not to optimize the text component.
     * @default true
     */
    text?: boolean;
  };
}

export type Optimizer = (path: NodePath<t.JSXOpeningElement>, log?: (message: string) => void) => void;

export type HubFile = t.File & {
  opts: {
    filename: string;
  };
  __hasImports?: Record<string, t.Identifier>;
  __optimized?: boolean;
};
