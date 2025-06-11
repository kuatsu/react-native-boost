import {
  processAccessibilityProps as _processAccessibilityProps,
  processTextStyle as _processTextStyle,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
<_NativeText
  {..._processAccessibilityProps(
    Object.assign(
      {},
      {
        'aria-label': 'test',
      },
      {
        accessibilityLabel: 'test',
      }
    )
  )}
  {..._processTextStyle([
    {
      color: 'red',
    },
    {
      fontSize: 16,
    },
  ])}
  allowFontScaling={true}
  ellipsizeMode={'tail'}
/>;
