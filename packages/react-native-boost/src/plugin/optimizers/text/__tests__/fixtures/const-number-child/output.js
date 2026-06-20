import {
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
const n = 5;
<_NativeText allowFontScaling={true} ellipsizeMode={'tail'} accessible={_getDefaultTextAccessible()}>
  {n}
</_NativeText>;
