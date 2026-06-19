import {
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
<_NativeText numberOfLines={10} allowFontScaling={true} ellipsizeMode={'tail'} accessible={_getDefaultTextAccessible()}>
  10 lines
</_NativeText>;
<_NativeText numberOfLines={0} allowFontScaling={true} ellipsizeMode={'tail'} accessible={_getDefaultTextAccessible()}>
  -10 lines
</_NativeText>;
<_NativeText numberOfLines={0} allowFontScaling={true} ellipsizeMode={'tail'} accessible={_getDefaultTextAccessible()}>
  0 lines
</_NativeText>;
