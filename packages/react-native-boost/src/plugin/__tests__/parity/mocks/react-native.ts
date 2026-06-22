import Platform from './Platform';
import { NativeTextCapturer, NativeViewCapturer } from '../capture';
import { flattenStyle } from '../normalize';
import { processColor } from './processColor';

// Bare-specifier `react-native` surface for the Boost side. It backs the runtime index's
// `import { StyleSheet, processColor } from 'react-native'` plus the dead leftover `import { Text, View }`
// the plugin leaves in generated code. The host components resolve to the shared capturers so any path
// that bottoms out here is still captured.
export { Platform };
// Same function the wrapper resolves (via the basename redirect to `mocks/processColor.ts`), so the
// `selectionColor` parity case has one unambiguous expected value across both sides.
export { processColor };
export const unstable_NativeText = NativeTextCapturer;
export const unstable_NativeView = NativeViewCapturer;
export const Text = NativeTextCapturer;
export const View = NativeViewCapturer;

// `processTextStyle` (the runtime under test) calls `StyleSheet.flatten`, so it must faithfully
// reproduce RN's flatten semantics — an identity stub would silently break every dynamic-`style` parity
// comparison (arrays would never merge, the top-level conversions would never fire). It shares the one
// `flattenStyle` the comparison normalizer uses, so the Boost side flattens identically to the wrapper.
export const StyleSheet = { flatten: flattenStyle };
