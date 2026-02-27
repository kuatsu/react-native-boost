/* eslint-disable @typescript-eslint/no-require-imports,unicorn/prefer-module */

const reactNative = require('react-native');
const isWeb = reactNative.Platform.OS === 'web';

let nativeText = reactNative.unstable_NativeText;

if (isWeb || nativeText == null) {
  // Fallback to regular Text component if unstable_NativeText is not available or we're on Web
  nativeText = reactNative.Text;
}

export const NativeText = nativeText;
