/* eslint-disable @typescript-eslint/no-require-imports,unicorn/prefer-module */

import type { ComponentType } from 'react';
import type { ViewProps } from 'react-native';

const reactNative = require('react-native');
const isWeb = reactNative.Platform.OS === 'web';

let nativeView = reactNative.unstable_NativeView;

if (isWeb || nativeView == null) {
  // Fallback to regular View component if unstable_NativeView is not available or we're on Web
  nativeView = reactNative.View;
}

/**
 * Native View component with graceful fallback.
 *
 * @remarks
 * Uses `unstable_NativeView` on supported native runtimes and falls back to `View`
 * on web or when the unstable export is unavailable.
 */
export const NativeView: ComponentType<ViewProps> = nativeView;
