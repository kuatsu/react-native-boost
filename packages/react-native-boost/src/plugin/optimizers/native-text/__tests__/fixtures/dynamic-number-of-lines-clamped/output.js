import {
  clampNumberOfLines as _clampNumberOfLines,
  getDefaultTextStyle as _getDefaultTextStyle,
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
<_NativeText
  style={_getDefaultTextStyle()}
  numberOfLines={_clampNumberOfLines(lineCount)}
  allowFontScaling={true}
  ellipsizeMode={'tail'}
  accessible={_getDefaultTextAccessible()}>
  identifier
</_NativeText>;
<_NativeText
  style={_getDefaultTextStyle()}
  numberOfLines={_clampNumberOfLines(getLines())}
  allowFontScaling={true}
  ellipsizeMode={'tail'}
  accessible={_getDefaultTextAccessible()}>
  call
</_NativeText>;
