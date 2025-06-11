// This is a dummy file to ensure that nothing breaks when using the runtime in a web environment.

import { TextProps, TextStyle } from 'react-native';
import { GenericStyleProp } from './types';

export const processTextStyle = (style: GenericStyleProp<TextStyle>) => ({ style }) as Partial<TextProps>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function processAccessibilityProps(props: Record<string, any>): Record<string, any> {
  return props;
}

export * from './types';
export * from './utils/constants';

// On Web, the native components are not available, so we use the standard components that'll be replaced by their DOM
// equivalents by react-native-web.
/* eslint-disable @typescript-eslint/no-require-imports,unicorn/prefer-module */
export const NativeText = require('react-native').Text;
export const NativeView = require('react-native').View;
/* eslint-enable @typescript-eslint/no-require-imports,unicorn/prefer-module */
