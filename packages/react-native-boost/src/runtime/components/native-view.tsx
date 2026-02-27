/* eslint-disable @typescript-eslint/no-require-imports,unicorn/prefer-module */

const reactNative = require('react-native');
const isWeb = reactNative.Platform.OS === 'web';

let nativeView = reactNative.unstable_NativeView;

if (isWeb || nativeView == null) {
  // Fallback to regular View component if unstable_NativeView is not available or we're on Web
  nativeView = reactNative.View;
}

export const NativeView = nativeView;
