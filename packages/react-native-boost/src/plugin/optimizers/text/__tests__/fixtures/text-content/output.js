import { NativeText as _NativeText } from 'react-native-boost/runtime';
import { Text } from 'react-native';
<_NativeText allowFontScaling={true} ellipsizeMode={'tail'}>
  Hello, world!
</_NativeText>;
const text = 'Hello again, world!';
<_NativeText allowFontScaling={true} ellipsizeMode={'tail'}>
  {text}
</_NativeText>;
