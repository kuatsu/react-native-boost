import Platform from './Platform';
import View from 'react-native/Libraries/Components/View/View';
import Text from 'react-native/Libraries/Text/Text';
import processColor from 'react-native/Libraries/StyleSheet/processColor';
import {
  NativeActivityIndicatorCapturer,
  NativeImageCapturer,
  NativeTextCapturer,
  NativeViewCapturer,
} from '../capture';
import flattenStyle from 'react-native/Libraries/StyleSheet/flattenStyle';

// Keep real Text and View wrappers for unoptimized elements so the oracle preserves nested context.
export { Platform, processColor, Text, View };
export { default as unstable_TextAncestorContext } from 'react-native/Libraries/Text/TextAncestorContext';
export const unstable_NativeText = NativeTextCapturer;
export const unstable_NativeView = NativeViewCapturer;
export const Animated = { Text, View };
export const Image = Object.assign(NativeImageCapturer, {
  resolveAssetSource: <T>(source: T): T => source,
});
export const ActivityIndicator = NativeActivityIndicatorCapturer;

// Both sides must inspect styles with the installed RN implementation.
export const StyleSheet: {
  flatten: typeof import('react-native').StyleSheet.flatten;
  compose: (first: unknown, second: unknown) => unknown;
} = {
  flatten: flattenStyle,
  compose: (first: unknown, second: unknown) => (second ? [first, second] : first),
};
