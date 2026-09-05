import {
  getDefaultTextStyle as _getDefaultTextStyle,
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
<>
  <Text
    onPress={() => {
      console.log('pressed');
    }}>
    Normally skipped due to blacklisted prop
  </Text>
  {/* @boost-force */}
  <_NativeText
    style={_getDefaultTextStyle() ? [_getDefaultTextStyle(), void 0] : void 0}
    onPress={() => {
      console.log('pressed');
    }}
    allowFontScaling={true}
    ellipsizeMode={'tail'}
    accessible={_getDefaultTextAccessible()}>
    Force optimized despite blacklisted prop
  </_NativeText>
</>;
