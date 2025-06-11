import { NativeText as _NativeText } from 'react-native-boost/runtime';
import { Text } from 'react-native';
<_NativeText allowFontScaling={true} ellipsizeMode={'tail'}>
  Hello, world!
</_NativeText>;
const test = (
  <_NativeText allowFontScaling={true} ellipsizeMode={'tail'}>
    Test
  </_NativeText>
);
<Text>{test}</Text>;
