import {
  processAccessibilityProps as _processAccessibilityProps,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
<_NativeText
  {..._processAccessibilityProps({
    'aria-hidden': true,
  })}
  allowFontScaling={true}
  ellipsizeMode={'tail'}>
  test
</_NativeText>;
