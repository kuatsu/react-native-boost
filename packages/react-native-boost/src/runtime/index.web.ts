// This is a dummy file to ensure that nothing breaks when using the runtime in a web environment.

import { ActivityIndicator as NativeActivityIndicator } from 'react-native';
import type { ActivityIndicatorProps, TextProps, TextStyle } from 'react-native';
import { GenericStyleProp } from './types';

export const textDefaultOverflowStyle = { overflow: 'hidden' } as const;

export const processTextStyle = (style: GenericStyleProp<TextStyle>, _includesDefaultStyle?: boolean) =>
  ({ style }) as Partial<TextProps>;

// react-native-web's `Text` accepts `selectionColor` and resolves colors itself, so there is no native
// int to pack — pass the value through untouched (mirroring the other web shims). Keeping the
// `{}`-on-null omission means the injected spread is a no-op when the prop is absent.
export function processSelectionColor(selectionColor?: unknown): { selectionColor?: unknown } {
  return selectionColor == null ? {} : { selectionColor };
}

export function resolveActivityIndicatorDefault<T>(value: T | undefined, fallback: T): T {
  return value === undefined ? fallback : value;
}

export const activityIndicatorStyles = {
  container: { alignItems: 'center', justifyContent: 'center' },
  small: { width: 20, height: 20 },
  large: { width: 36, height: 36 },
} as const;

export function processActivityIndicatorStyle(style: ActivityIndicatorProps['style']): ActivityIndicatorProps['style'] {
  return style ? [activityIndicatorStyles.container, style] : activityIndicatorStyles.container;
}

export function processActivityIndicatorSize(size: ActivityIndicatorProps['size'] = 'small') {
  if (size === 'small') return { style: activityIndicatorStyles.small, size };
  if (size === 'large') return { style: activityIndicatorStyles.large, size };
  return { style: { height: size, width: size }, size: undefined };
}

export { NativeActivityIndicator };

// On Web there is no platform-specific `accessible` default to apply; react-native-web's `Text`
// derives accessibility from the rendered DOM. Returning `undefined` makes the injected
// `accessible={getDefaultTextAccessible()}` a no-op.
export const getDefaultTextAccessible = (): boolean | undefined => undefined;

// Web has no native Text host, so there is no `overflow: 'hidden'` default to replicate.
export const getDefaultTextStyle = (): undefined => undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function processTextAccessibilityProps(props: Record<string, any>): Record<string, any> {
  return props;
}

// On Web the native components fall back to react-native-web's `View`, which performs its own
// aria→accessibility translation, so the runtime helper passes props through untouched to avoid
// double-translation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function processViewAccessibilityProps(props: Record<string, any>): Record<string, any> {
  return props;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function processImageAccessibilityProps(props: Record<string, any>): Record<string, any> {
  return props;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function processImageSourceProps(props: Record<string, any>): Record<string, any> {
  return props;
}

// The plugin skips `Image` entirely on web, so these gates are never emitted into a web build. They
// exist so the web shim still exposes the full native runtime surface if a natively-transformed file
// is bundled for web; react-native-web reads neither a top-level `headers` prop nor these dimensions.
export const processImageObjectSourceHeaders = <T>(headers: T): T => headers;
export const processImageArraySourceDimensions = <T>(dimensions: T): T => dimensions;

export * from './types';
export * from './utils/constants';

// On Web, the native components are not available, so we use the standard components that'll be replaced by their DOM
// equivalents by react-native-web.
/* eslint-disable @typescript-eslint/no-require-imports,unicorn/prefer-module */
export const NativeText = require('react-native').Text;
export const NativeView = require('react-native').View;
export const NativeViewWithContext = NativeView;
export const NativeImage = require('react-native').Image;
/* eslint-enable @typescript-eslint/no-require-imports,unicorn/prefer-module */
