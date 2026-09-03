import {
  getDefaultTextStyle as _getDefaultTextStyle,
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
<>
  <_NativeText
    style={_getDefaultTextStyle()}
    allowFontScaling={true}
    ellipsizeMode={'tail'}
    accessible={_getDefaultTextAccessible()}>
    Optimize this
  </_NativeText>
  {/* @boost-ignore */}
  <Text>But don't optimize this</Text>
</>;
