import {
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
<_NativeText allowFontScaling={true} ellipsizeMode={'tail'} accessible={_getDefaultTextAccessible()}>
  Hello, world!
</_NativeText>;
<Text
  onPress={() => {
    console.log('pressed');
  }}>
  Hello, world!
</Text>;
