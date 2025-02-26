import {
  normalizeAccessibilityProps as _normalizeAccessibilityProps,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
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
/>;
