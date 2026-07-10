import {
  processTextAccessibilityProps as _processTextAccessibilityProps,
  getDefaultTextStyle as _getDefaultTextStyle,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
<_NativeText
  {..._processTextAccessibilityProps({
    'aria-label': 'test',
    'accessibilityLabel': 'test',
  })}
  style={[
    _getDefaultTextStyle(),
    {
      color: 'red',
      fontSize: 16,
    },
  ]}
  allowFontScaling={true}
  ellipsizeMode={'tail'}
/>;
