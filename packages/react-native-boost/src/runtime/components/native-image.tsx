/* eslint-disable @typescript-eslint/no-require-imports,unicorn/prefer-module */

import type { ComponentType } from 'react';
import type { ImageProps } from 'react-native';

const reactNative = require('react-native');
const isWeb = reactNative.Platform.OS === 'web';

let nativeImage = reactNative.Image;

if (!isWeb) {
  try {
    nativeImage = require('react-native/Libraries/Image/ImageViewNativeComponent').default ?? reactNative.Image;
  } catch {
    nativeImage = reactNative.Image;
  }
}

/**
 * Native Image component with graceful fallback.
 *
 * @remarks
 * React Native does not expose an `unstable_NativeImage`, so this uses the internal host when
 * available and falls back to `Image`.
 */
export const NativeImage: ComponentType<ImageProps> = nativeImage;
