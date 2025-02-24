/* eslint-disable @typescript-eslint/no-require-imports,unicorn/prefer-module */
import { Platform } from 'react-native';

export const NativeText =
  Platform.OS === 'web'
    ? require('react-native').Text
    : require('react-native/Libraries/Text/TextNativeComponent').NativeText;
