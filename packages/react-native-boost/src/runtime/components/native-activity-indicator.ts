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

function getHost(iosHost: string): ComponentType<ActivityIndicatorProps> {
  if (Platform.OS === 'android') return 'AndroidProgressBar' as unknown as ComponentType<ActivityIndicatorProps>;
  if (Platform.OS === 'ios') return iosHost as unknown as ComponentType<ActivityIndicatorProps>;
  return ActivityIndicator;
}

/**
 * Native ActivityIndicator component with graceful fallback.
 */
export const NativeActivityIndicator = getHost('ActivityIndicatorView');

/**
 * The host for RN < 0.88, which registers the iOS view config with the `RCT` prefix.
 */
export const LegacyNativeActivityIndicator = getHost('RCTActivityIndicatorView');
