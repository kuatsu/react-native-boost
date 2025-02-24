/* eslint-disable @typescript-eslint/no-require-imports,unicorn/prefer-module */
import { Platform } from 'react-native';

export const NativeView =
  Platform.OS === 'web'
    ? require('react-native').View
    : require('react-native/Libraries/Components/View/ViewNativeComponent').default;
