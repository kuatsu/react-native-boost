import {
  processTextAccessibilityProps as _processTextAccessibilityProps,
  getDefaultTextStyle as _getDefaultTextStyle,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
<_NativeText
  {..._processTextAccessibilityProps({
    'aria-hidden': true,
  })}
  style={_getDefaultTextStyle() ? [_getDefaultTextStyle(), void 0] : void 0}
  allowFontScaling={true}
  ellipsizeMode={'tail'}>
  test
</_NativeText>;
