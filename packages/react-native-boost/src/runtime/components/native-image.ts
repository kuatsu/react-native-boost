import type { ComponentType } from 'react';
import type { ImageProps } from 'react-native';
import * as reactNativeModule from 'react-native';

type ReactNativeImageModule = {
  Image: ComponentType<ImageProps>;
  Platform: {
    OS: string;
  };
};

const { Image, Platform } = reactNativeModule as ReactNativeImageModule;

/**
 * Native Image component with graceful fallback.
 */
export const NativeImage: ComponentType<ImageProps> =
  Platform.OS === 'web' ? Image : ('RCTImageView' as unknown as ComponentType<ImageProps>);
