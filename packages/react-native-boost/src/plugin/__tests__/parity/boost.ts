import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { transformSync, type TransformCaller } from '@babel/core';
import * as React from 'react';
import boostPlugin from '../../index'; // src/plugin/index.ts — the full Boost plugin
import { RUNTIME_MODULE_NAME } from '../../utils/constants';
import { renderAndCaptureSingle } from './capture';
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
 * Transform a JSX body with the full Boost plugin under the given platform (mirroring how Metro builds
 * per platform, so the plugin inlines build-time defaults exactly as in production). Returns the
 * generated code.
 */
function transformBoostCase(os: 'ios' | 'android', jsxBody: string): string {
  setPlatformOS(os);
  const source = `import { Text, View } from 'react-native';\nexport default function Case(){ return ${jsxBody}; }`;
  const out = transformSync(source, {
    configFile: false,
    babelrc: false,
    filename: 'boost-case.jsx',
    caller: { name: 'metro', platform: os } as TransformCaller,
    presets: [['@babel/preset-react', { runtime: 'automatic' }]],
    plugins: [[boostPlugin, { silent: true }]],
  });
  return out!.code!;
}

/**
 * Whether Boost optimized anything in the snippet — it injects the runtime import iff it rewrote an
 * element. A compile-only check (no render), so nested snippets that produce multiple hosts can assert
 * deferral without tripping {@link renderAndCaptureSingle}.
 */
export function boostOptimizes(os: 'ios' | 'android', jsxBody: string): boolean {
  return transformBoostCase(os, jsxBody).includes(RUNTIME_MODULE_NAME);
}

/**
 * Transform a JSX body with Boost and render the result with the REAL runtime helpers (the components
 * are mocked to the shared capturers by the test). Returns `{ optimized: false }` when Boost bailed —
 * it then defers to the wrapper, so the case is equivalent by construction and the test skips it.
 */
export async function captureBoost(os: 'ios' | 'android', jsxBody: string): Promise<BoostBailed | BoostOptimized> {
  const code = transformBoostCase(os, jsxBody);
  // Single-element snippet: the runtime import is injected iff that element was optimized.
  if (!code.includes(RUNTIME_MODULE_NAME)) return { optimized: false };

  const file = fileURLToPath(new URL(`./__generated__/boost-${counter++}.js`, import.meta.url));
  writeFileSync(file, code);
  const mod = await import(/* @vite-ignore */ file);
  const { which, props } = renderAndCaptureSingle(React.createElement(mod.default));
  return { optimized: true, which, props };
}
