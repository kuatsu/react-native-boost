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
import { flattenStyle } from '../normalize';

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

// `processTextStyle` (the runtime under test) calls `StyleSheet.flatten`, so it must faithfully
// reproduce RN's flatten semantics — an identity stub would silently break every dynamic-`style` parity
// comparison (arrays would never merge, the top-level conversions would never fire). It shares the one
// `flattenStyle` the comparison normalizer uses, so the Boost side flattens identically to the wrapper.
export const StyleSheet = {
  flatten: flattenStyle,
  compose: (first: unknown, second: unknown) => (second ? [first, second] : first),
};
