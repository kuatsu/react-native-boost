import type { ComponentType } from 'react';
import type { ActivityIndicatorProps } from 'react-native';
import * as reactNativeModule from 'react-native';

type ReactNativeActivityIndicatorModule = {
  ActivityIndicator: ComponentType<ActivityIndicatorProps>;
  Platform: {
    OS: string;
  };
};

const { ActivityIndicator, Platform } = reactNativeModule as ReactNativeActivityIndicatorModule;

/**
 * Native ActivityIndicator component with graceful fallback.
 */
export const NativeActivityIndicator: ComponentType<ActivityIndicatorProps> =
  Platform.OS === 'android'
    ? ('AndroidProgressBar' as unknown as ComponentType<ActivityIndicatorProps>)
    : Platform.OS === 'ios'
      ? ('RCTActivityIndicatorView' as unknown as ComponentType<ActivityIndicatorProps>)
      : ActivityIndicator;
