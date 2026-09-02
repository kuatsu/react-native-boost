import type { ComponentType } from 'react';
import type { ImageProps } from 'react-native';
import * as reactNativeModule from 'react-native';

type ReactNativeImageModule = {
  Image: ComponentType<ImageProps>;
  Platform: {
    OS: string;
  };
};

// Accessing Image loads its module, which registers the RCTImageView host before the string is used.
const { Image, Platform } = reactNativeModule as ReactNativeImageModule;

/**
 * Native Image host registered by React Native's public `Image` module.
 *
 * React Native's component registry returns the host name as the component value. This avoids RN's
 * deprecated `Libraries` deep import and its Babel warning. Keep the public `Image` access above:
 * using the string without first loading `Image` leaves the host unregistered.
 */
export const NativeImage: ComponentType<ImageProps> =
  Platform.OS === 'web' ? Image : ('RCTImageView' as unknown as ComponentType<ImageProps>);
