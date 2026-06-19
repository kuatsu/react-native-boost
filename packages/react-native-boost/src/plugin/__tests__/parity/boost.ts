import { writeFileSync } from 'node:fs';
import { transformSync } from '@babel/core';
import * as React from 'react';
import boostPlugin from '../../index'; // src/plugin/index.ts — the full Boost plugin
import { RUNTIME_MODULE_NAME } from '../../utils/constants';
import { renderAndCapture } from './capture';
import { setPlatformOS } from './mocks/Platform';

let counter = 0;

interface BoostBailed {
  optimized: false;
}

interface BoostOptimized {
  optimized: true;
  which?: string;
  props: Record<string, unknown>;
}

/**
 * Transform a JSX body with the full Boost plugin and render the result with the REAL runtime
 * helpers (the components are mocked to the shared capturers by the test). Returns
 * `{ optimized: false }` when Boost bailed — it then defers to the wrapper, so the case is
 * equivalent by construction and the test skips it.
 *
 * Rendered under the given platform (like {@link captureWrapper}) because the runtime helpers read
 * `Platform.OS`/`Platform.select` at render time to resolve platform-specific defaults such as
 * `accessible`.
 */
export async function captureBoost(os: 'ios' | 'android', jsxBody: string): Promise<BoostBailed | BoostOptimized> {
  setPlatformOS(os);
  const source = `import { Text, View } from 'react-native';\nexport default function Case(){ return ${jsxBody}; }`;
  const out = transformSync(source, {
    configFile: false,
    babelrc: false,
    filename: 'boost-case.jsx',
    presets: [['@babel/preset-react', { runtime: 'automatic' }]],
    plugins: [[boostPlugin, { silent: true }]],
  });
  const code = out!.code!;
  // Single-element snippet: the runtime import is injected iff that element was optimized.
  if (!code.includes(RUNTIME_MODULE_NAME)) return { optimized: false };

  const file = new URL(`./__generated__/boost-${counter++}.js`, import.meta.url).pathname;
  writeFileSync(file, code);
  const mod = await import(/* @vite-ignore */ file);
  const { which, props } = renderAndCapture(React.createElement(mod.default));
  return { optimized: true, which, props };
}
