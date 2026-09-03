/* eslint-disable @typescript-eslint/no-require-imports,unicorn/prefer-module */

import type { ComponentType } from 'react';
import type { ViewProps } from 'react-native';

const reactNative = require('react-native');
const isWeb = reactNative.Platform.OS === 'web';

let nativeView = reactNative.unstable_NativeView;

if (isWeb || nativeView == null) {
  nativeView = reactNative.View;
}

/**
 * Native View component with graceful fallback.
 */
export const NativeView: ComponentType<ViewProps> = nativeView;
