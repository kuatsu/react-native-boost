/* eslint-disable @typescript-eslint/no-require-imports,unicorn/prefer-module */

import type { ComponentType } from 'react';
import type { ImageProps } from 'react-native';
import * as reactNativeModule from 'react-native';

type ReactNativeImageModule = {
  Image: ComponentType<ImageProps>;
  Platform: {
    OS: string;
  };
};

type NativeImageModule = {
  default?: ComponentType<ImageProps>;
};

const reactNative = reactNativeModule as ReactNativeImageModule;

function loadImageViewNativeComponent(): NativeImageModule {
  return require('react-native/Libraries/Image/ImageViewNativeComponent');
}

function resolveNativeImageComponent(
  reactNativeModule: ReactNativeImageModule,
  loadNativeComponent: () => NativeImageModule = loadImageViewNativeComponent
): ComponentType<ImageProps> {
  if (reactNativeModule.Platform.OS === 'web') return reactNativeModule.Image;

  try {
    return loadNativeComponent().default ?? reactNativeModule.Image;
  } catch {
    return reactNativeModule.Image;
  }
}

/**
 * Native Image component with graceful fallback.
 *
 * @remarks
 * React Native does not expose an `unstable_NativeImage`, so this uses the internal host when
 * available and falls back to `Image`.
 */
export const NativeImage: ComponentType<ImageProps> = resolveNativeImageComponent(reactNative);
