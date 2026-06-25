// This is a dummy file to ensure that nothing breaks when using the runtime in a web environment.

import { TextProps, TextStyle } from 'react-native';
import { GenericStyleProp } from './types';

export const processTextStyle = (style: GenericStyleProp<TextStyle>) => ({ style }) as Partial<TextProps>;

// react-native-web's `Text` accepts `selectionColor` and resolves colors itself, so there is no native
// int to pack — pass the value through untouched (mirroring the other web shims). Keeping the
// `{}`-on-null omission means the injected spread is a no-op when the prop is absent.
export function processSelectionColor(selectionColor?: unknown): { selectionColor?: unknown } {
  return selectionColor == null ? {} : { selectionColor };
}

// On Web there is no platform-specific `accessible` default to apply; react-native-web's `Text`
// derives accessibility from the rendered DOM. Returning `undefined` makes the injected
// `accessible={getDefaultTextAccessible()}` a no-op.
export const getDefaultTextAccessible = (): boolean | undefined => undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function processAccessibilityProps(props: Record<string, any>): Record<string, any> {
  return props;
}

// On Web the native components fall back to react-native-web's `View`, which performs its own
// aria→accessibility translation, so the runtime helper passes props through untouched to avoid
// double-translation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function processViewAccessibilityProps(props: Record<string, any>): Record<string, any> {
  return props;
}

export * from './types';
export * from './utils/constants';

// On Web, the native components are not available, so we use the standard components that'll be replaced by their DOM
// equivalents by react-native-web.
/* eslint-disable @typescript-eslint/no-require-imports,unicorn/prefer-module */
export const NativeText = require('react-native').Text;
export const NativeView = require('react-native').View;
export const NativeImage = require('react-native').Image;
/* eslint-enable @typescript-eslint/no-require-imports,unicorn/prefer-module */
