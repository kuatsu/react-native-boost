import {
  normalizeAccessibilityProps as _normalizeAccessibilityProps,
  flattenTextStyle as _flattenTextStyle,
  NativeText as _NativeText,
} from 'react-native-boost';
import { Text } from 'react-native';
<_NativeText
  {..._normalizeAccessibilityProps(
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
  {..._flattenTextStyle([
    {
      color: 'red',
    },
    {
      fontSize: 16,
    },
  ])}
/>;
