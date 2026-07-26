import {
  getDefaultTextStyle as _getDefaultTextStyle,
  processSelectionColor as _processSelectionColor,
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
<_NativeText
  {..._processSelectionColor(accent)}
  style={_getDefaultTextStyle()}
  allowFontScaling={true}
  ellipsizeMode={'tail'}
  accessible={_getDefaultTextAccessible()}>
  hello
</_NativeText>;
