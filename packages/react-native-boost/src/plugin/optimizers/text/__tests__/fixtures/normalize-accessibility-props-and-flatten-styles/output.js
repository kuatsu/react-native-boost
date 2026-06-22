import {
  processAccessibilityProps as _processAccessibilityProps,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
<_NativeText
  {..._processAccessibilityProps({
    'aria-label': 'test',
    'accessibilityLabel': 'test',
  })}
  style={{
    color: 'red',
    fontSize: 16,
  }}
  allowFontScaling={true}
  ellipsizeMode={'tail'}
/>;
