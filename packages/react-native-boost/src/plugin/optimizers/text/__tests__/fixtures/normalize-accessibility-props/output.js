import {
  processTextAccessibilityProps as _processTextAccessibilityProps,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
<_NativeText
  {..._processTextAccessibilityProps({
    'aria-label': 'test',
    'accessibilityLabel': 'test',
  })}
  allowFontScaling={true}
  ellipsizeMode={'tail'}
/>;
