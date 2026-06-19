import {
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
<_NativeText allowFontScaling={true} ellipsizeMode={'tail'} accessible={_getDefaultTextAccessible()}>
  Hello, world!
</_NativeText>;
const test = (
  <_NativeText allowFontScaling={true} ellipsizeMode={'tail'} accessible={_getDefaultTextAccessible()}>
    Test
  </_NativeText>
);
<Text>{test}</Text>;
