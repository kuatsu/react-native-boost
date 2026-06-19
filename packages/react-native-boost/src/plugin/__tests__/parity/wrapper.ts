import { writeFileSync } from 'node:fs';
import { transformSync } from '@babel/core';
import * as React from 'react';
import { renderAndCapture } from './capture';
import { setPlatformOS } from './mocks/Platform';

let counter = 0;

/**
 * Render the REAL React Native `Text`/`View` wrapper for a JSX body on the given platform and return
 * the prop bag its native host received. This is the oracle the Boost output is compared against.
 *
 * The snippet is wrapped in a module importing RN's deep wrapper sources, transformed with
 * `@babel/preset-react`, written to `__generated__/`, and dynamically imported so its `react-native`
 * deep imports and `react/jsx-runtime` import resolve through the parity vite pipeline.
 */
export async function captureWrapper(os: 'ios' | 'android', jsxBody: string) {
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
  const file = new URL(`./__generated__/wrapper-${os}-${counter++}.js`, import.meta.url).pathname;
  writeFileSync(file, out!.code!);
  const mod = await import(/* @vite-ignore */ file);
  return renderAndCapture(React.createElement(mod.default));
}
