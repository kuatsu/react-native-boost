/* eslint-disable @typescript-eslint/no-require-imports,unicorn/prefer-module */

import type { ComponentType } from 'react';
import type { TextProps } from 'react-native';

const reactNative = require('react-native');
const isWeb = reactNative.Platform.OS === 'web';

let nativeText = reactNative.unstable_NativeText;

if (isWeb || nativeText == null) {
  // Fallback to regular Text component if unstable_NativeText is not available or we're on Web
  nativeText = reactNative.Text;
}

/**
 * Native Text component with graceful fallback.
 *
 * @remarks
 * Uses `unstable_NativeText` on supported native runtimes and falls back to `Text`
 * on web or when the unstable export is unavailable.
 */
export const NativeText: ComponentType<TextProps> = nativeText;
