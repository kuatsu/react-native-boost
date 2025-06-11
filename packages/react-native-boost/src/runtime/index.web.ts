// This is a dummy file to ensure that nothing breaks when using the runtime in a web environment.

import { TextStyle } from 'react-native';
import { GenericStyleProp } from './types';

export function flattenTextStyle(style: GenericStyleProp<TextStyle>) {
  if (!style) return {};

  return { style };
}

// Maps the `userSelect` prop to the native `selectable` prop
export const userSelectToSelectableMap = {
  auto: true,
  text: true,
  none: false,
  contain: true,
  all: true,
};

// Maps the `verticalAlign` prop to the native `textAlignVertical` prop
export const verticalAlignToTextAlignVerticalMap = {
  auto: 'auto',
  top: 'top',
  bottom: 'bottom',
  middle: 'center',
};

/**
 * Normalizes accessibility props.
 *
 * @param props - The props to normalize.
 * @returns The normalized props.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeAccessibilityProperties(props: Record<string, any>): Record<string, any> {
  return props;
}

export * from './types';

// On Web, the native components are not available, so we use the standard components that'll be replaced by their DOM
// equivalents by react-native-web.
/* eslint-disable @typescript-eslint/no-require-imports,unicorn/prefer-module */
export const NativeText = require('react-native').Text;
export const NativeView = require('react-native').View;
/* eslint-enable @typescript-eslint/no-require-imports,unicorn/prefer-module */
