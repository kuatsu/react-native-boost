import {
  processTextAccessibilityProps as _processTextAccessibilityProps,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
<_NativeText
  {..._processTextAccessibilityProps({
    'aria-hidden': true,
  })}
  allowFontScaling={true}
  ellipsizeMode={'tail'}>
  test
</_NativeText>;
