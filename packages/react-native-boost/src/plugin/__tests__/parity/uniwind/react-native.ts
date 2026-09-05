export * from '../mocks/react-native';
export { default as Text } from 'react-native/Libraries/Text/Text';
import * as React from 'react';
import ImageIOS from 'react-native/Libraries/Image/Image.ios';
import ImageAndroid from 'react-native/Libraries/Image/Image.android';
import Platform from '../mocks/Platform';
export const Image: React.ComponentType<import('react-native').ImageProps> &
  Pick<typeof ImageIOS, 'resolveAssetSource'> = Object.assign(
  (props: React.ComponentProps<typeof ImageIOS>) =>
    React.createElement(Platform.OS === 'android' ? ImageAndroid : ImageIOS, props),
  { resolveAssetSource: ImageIOS.resolveAssetSource }
);
export { default as ActivityIndicator } from 'react-native/Libraries/Components/ActivityIndicator/ActivityIndicator';
export const Dimensions = { get: () => ({ width: 400, height: 800 }), addEventListener: () => ({ remove() {} }) };
export const Appearance = {
  getColorScheme: () => 'light',
  addChangeListener: () => ({ remove() {} }),
  setColorScheme() {},
};
export const I18nManager = { isRTL: false };
export const PixelRatio = { get: () => 2, getFontScale: () => 1 };
