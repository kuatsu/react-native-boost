import { transformSync } from '@babel/core';
import * as React from 'react';
import { renderAndCaptureAll, renderAndCaptureSingle, type Capture } from './capture';
import { writeAndImportFresh } from './generated';
import { setPlatformOS, type PlatformOS } from './mocks/Platform';

/**
 * Compile a JSX body against RN's deep wrapper sources and return its default-exported component. The
 * snippet is wrapped in a module importing the real `Text`/`View` wrappers, transformed with
 * `@babel/preset-react`, written to `__generated__/`, and dynamically imported so its `react-native`
 * deep imports and `react/jsx-runtime` import resolve through the parity vite pipeline.
 */
async function compileWrapperCase(os: PlatformOS, jsxBody: string, preamble = ''): Promise<React.ComponentType> {
  setPlatformOS(os); // Text.js reads Platform.select at render time
  const source =
    `import Text from 'react-native/Libraries/Text/Text';\n` +
    `import View from 'react-native/Libraries/Components/View/View';\n${preamble}\n` +
    `export default function Case(){ return ${jsxBody}; }`;
  const out = transformSync(source, {
    configFile: false,
    babelrc: false,
    filename: 'wrapper-case.jsx',
    presets: [['@babel/preset-react', { runtime: 'automatic' }]],
  });
  const mod = await writeAndImportFresh('wrapper', out!.code!);
  return mod.default;
}

/**
 * Render the REAL React Native `Text`/`View` wrapper for a single-host JSX body and return the prop
 * bag its native host received. This is the oracle the Boost output is compared against.
 */
export async function captureWrapper(os: PlatformOS, jsxBody: string, preamble = ''): Promise<Capture> {
  const Case = await compileWrapperCase(os, jsxBody, preamble);
  return renderAndCaptureSingle(React.createElement(Case));
}

/**
 * Like {@link captureWrapper} but returns every native host the wrapper produced, in render order.
 * Used by nested cases (e.g. `<Text>x <Text>y</Text></Text>`) where the wrapper renders an outer
 * `NativeText` and an inner `NativeVirtualText`.
 */
export async function captureWrapperHosts(os: PlatformOS, jsxBody: string, preamble = ''): Promise<Capture[]> {
  const Case = await compileWrapperCase(os, jsxBody, preamble);
  return renderAndCaptureAll(React.createElement(Case));
}
