import {
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'some-other-package';
import { Text as RNText } from 'react-native';
<Text>Hello, world!</Text>;
<_NativeText allowFontScaling={true} ellipsizeMode={'tail'} accessible={_getDefaultTextAccessible()}>
  This is from React Native
</_NativeText>;
