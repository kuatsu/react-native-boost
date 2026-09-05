import {
  getDefaultTextStyle as _getDefaultTextStyle,
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text, View } from 'react-native';
<View>
  <_NativeText
    style={_getDefaultTextStyle() ? [_getDefaultTextStyle(), void 0] : void 0}
    allowFontScaling={true}
    ellipsizeMode={'tail'}
    accessible={_getDefaultTextAccessible()}>
    hello
  </_NativeText>
</View>;
