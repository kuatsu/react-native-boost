/* eslint-disable @typescript-eslint/no-require-imports,unicorn/prefer-module */

import type { ComponentType } from 'react';
import type { TextProps } from 'react-native';

const reactNative = require('react-native');
const isWeb = reactNative.Platform.OS === 'web';

let nativeText = reactNative.unstable_NativeText;

if (isWeb || nativeText == null) {
  nativeText = reactNative.Text;
}

/**
 * Native Text component with graceful fallback.
 */
export const NativeText: ComponentType<TextProps> = nativeText;
