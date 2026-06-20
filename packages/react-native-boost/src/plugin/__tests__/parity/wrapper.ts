import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { transformSync } from '@babel/core';
import * as React from 'react';
import { renderAndCaptureAll, renderAndCaptureSingle, type Capture } from './capture';
import { setPlatformOS } from './mocks/Platform';

let counter = 0;

/**
 * Compile a JSX body against RN's deep wrapper sources and return its default-exported component. The
 * snippet is wrapped in a module importing the real `Text`/`View` wrappers, transformed with
 * `@babel/preset-react`, written to `__generated__/`, and dynamically imported so its `react-native`
 * deep imports and `react/jsx-runtime` import resolve through the parity vite pipeline.
 */
async function compileWrapperCase(os: 'ios' | 'android', jsxBody: string): Promise<React.ComponentType> {
  setPlatformOS(os); // Text.js reads Platform.select at render time
  const source =
    `import Text from 'react-native/Libraries/Text/Text';\n` +
    `import View from 'react-native/Libraries/Components/View/View';\n` +
    `export default function Case(){ return ${jsxBody}; }`;
  const out = transformSync(source, {
    configFile: false,
    babelrc: false,
    filename: 'wrapper-case.jsx',
    presets: [['@babel/preset-react', { runtime: 'automatic' }]],
  });
  const file = fileURLToPath(new URL(`./__generated__/wrapper-${os}-${counter++}.js`, import.meta.url));
  writeFileSync(file, out!.code!);
  const mod = await import(/* @vite-ignore */ file);
  return mod.default;
}

/**
 * Render the REAL React Native `Text`/`View` wrapper for a single-host JSX body and return the prop
 * bag its native host received. This is the oracle the Boost output is compared against.
 */
export async function captureWrapper(os: 'ios' | 'android', jsxBody: string): Promise<Capture> {
  const Case = await compileWrapperCase(os, jsxBody);
  return renderAndCaptureSingle(React.createElement(Case));
}

/**
 * Like {@link captureWrapper} but returns every native host the wrapper produced, in render order.
 * Used by nested cases (e.g. `<Text>x <Text>y</Text></Text>`) where the wrapper renders an outer
 * `NativeText` and an inner `NativeVirtualText`.
 */
export async function captureWrapperHosts(os: 'ios' | 'android', jsxBody: string): Promise<Capture[]> {
  const Case = await compileWrapperCase(os, jsxBody);
  return renderAndCaptureAll(React.createElement(Case));
}
