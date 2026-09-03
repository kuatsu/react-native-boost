import {
  getDefaultTextStyle as _getDefaultTextStyle,
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
<_NativeText
  style={_getDefaultTextStyle()}
  allowFontScaling={true}
  ellipsizeMode={'tail'}
  accessible={_getDefaultTextAccessible()}>
  Hello
</_NativeText>;
<_NativeText
  style={_getDefaultTextStyle()}
  allowFontScaling={false}
  ellipsizeMode={'tail'}
  accessible={_getDefaultTextAccessible()}>
  No Scaling
</_NativeText>;
const partialProps = {
  color: 'blue',
  ellipsizeMode: 'clip',
};
<_NativeText
  style={_getDefaultTextStyle()}
  {...partialProps}
  allowFontScaling={true}
  accessible={_getDefaultTextAccessible()}>
  Partial props
</_NativeText>;
