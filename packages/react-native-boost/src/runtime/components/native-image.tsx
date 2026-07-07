/* eslint-disable @typescript-eslint/no-require-imports,unicorn/prefer-module */

import type { ComponentType } from 'react';
import { createElement } from 'react';
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

type FallbackImageProps = Omit<ImageProps, 'src'> & {
  headers?: unknown;
  src?: unknown;
};

const reactNative = reactNativeModule as ReactNativeImageModule;

function loadImageViewNativeComponent(): NativeImageModule {
  return require('react-native/Libraries/Image/ImageViewNativeComponent');
}

export function resolveNativeImageComponent(
  reactNativeModule: ReactNativeImageModule,
  loadNativeComponent: () => NativeImageModule = loadImageViewNativeComponent
): ComponentType<ImageProps> {
  if (reactNativeModule.Platform.OS === 'web') return reactNativeModule.Image;

  try {
    return loadNativeComponent().default ?? createFallbackImageComponent(reactNativeModule.Image);
  } catch {
    return createFallbackImageComponent(reactNativeModule.Image);
  }
}

function createFallbackImageComponent(ImageComponent: ComponentType<ImageProps>): ComponentType<ImageProps> {
  const FallbackImage = ({ headers: _headers, src: _src, ...props }: FallbackImageProps) =>
    createElement(ImageComponent, props);

  return FallbackImage as ComponentType<ImageProps>;
}

/**
 * Native Image component with graceful fallback.
 *
 * @remarks
 * React Native does not expose an `unstable_NativeImage`, so this uses the internal host when
 * available and falls back to `Image`.
 */
export const NativeImage: ComponentType<ImageProps> = resolveNativeImageComponent(reactNative);
