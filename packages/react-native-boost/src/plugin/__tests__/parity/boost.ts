import { transformSync, type TransformCaller } from '@babel/core';
import * as React from 'react';
import boostPlugin from '../../index'; // src/plugin/index.ts — the full Boost plugin
import { RUNTIME_MODULE_NAME } from '../../utils/constants';
import { renderAndCaptureSingle } from './capture';
import { writeAndImportFresh } from './generated';
import { setPlatformOS, type PlatformOS } from './mocks/Platform';

interface BoostBailed {
  optimized: false;
}

interface BoostOptimized {
  optimized: true;
  which: string;
  props: Record<string, unknown>;
}

/**
 * Transform a JSX body with the full Boost plugin under the given platform (mirroring how Metro builds
 * per platform, so the plugin inlines build-time defaults exactly as in production). Returns the
 * generated code.
 */
function transformBoostCase(os: PlatformOS, jsxBody: string, preamble = ''): string {
  setPlatformOS(os);
  const source =
    `import { Image, Text, View } from 'react-native';\n${preamble}\n` +
    `export default function Case(){ return ${jsxBody}; }`;
  const out = transformSync(source, {
    configFile: false,
    babelrc: false,
    filename: 'boost-case.jsx',
    caller: { name: 'metro', platform: os } as TransformCaller,
    presets: [['@babel/preset-react', { runtime: 'automatic' }]],
    plugins: [[boostPlugin, { silent: true, optimizations: { image: true } }]],
  });
  return out!.code!;
}

/**
 * Whether Boost optimized anything in the snippet — it injects the runtime import iff it rewrote an
 * element. A compile-only check (no render), so nested snippets that produce multiple hosts can assert
 * deferral without tripping {@link renderAndCaptureSingle}.
 */
export function boostOptimizes(os: PlatformOS, jsxBody: string): boolean {
  return transformBoostCase(os, jsxBody).includes(RUNTIME_MODULE_NAME);
}

/**
 * Transform a JSX body with Boost and render the result with the REAL runtime helpers (the components
 * are mocked to the shared capturers by the test). Returns `{ optimized: false }` when Boost bailed —
 * it then defers to the wrapper, so the case is equivalent by construction and the test skips it.
 */
export async function captureBoost(
  os: PlatformOS,
  jsxBody: string,
  preamble = ''
): Promise<BoostBailed | BoostOptimized> {
  const code = transformBoostCase(os, jsxBody, preamble);
  // Single-element snippet: the runtime import is injected iff that element was optimized.
  if (!code.includes(RUNTIME_MODULE_NAME)) return { optimized: false };

  const mod = await writeAndImportFresh('boost', code);
  const { which, props } = renderAndCaptureSingle(React.createElement(mod.default));
  return { optimized: true, which, props };
}
