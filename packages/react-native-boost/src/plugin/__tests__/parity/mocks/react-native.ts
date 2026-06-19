import Platform from './Platform';
import { NativeTextCapturer, NativeViewCapturer } from '../capture';

// Bare-specifier `react-native` surface for the Boost side. It backs the runtime index's
// `import { StyleSheet } from 'react-native'` plus the dead leftover `import { Text, View }` the
// plugin leaves in generated code. The host components resolve to the shared capturers so any path
// that bottoms out here is still captured.
export { Platform };
export const unstable_NativeText = NativeTextCapturer;
export const unstable_NativeView = NativeViewCapturer;
export const Text = NativeTextCapturer;
export const View = NativeViewCapturer;
export const StyleSheet = { flatten: <T>(style: T) => style };
