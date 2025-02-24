import { NodePath, types as t } from '@babel/core';

export interface PluginOptions {
  /**
   * Paths to ignore from optimization. Relative to the Babel configuration file.
   */
  ignores?: string[];
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
     * Whether or not to optimize the Text component.
     * @default true
     */
    text?: boolean;
    /**
     * Whether or not to optimize the View component.
     * @default true
     */
    view?: boolean;
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
