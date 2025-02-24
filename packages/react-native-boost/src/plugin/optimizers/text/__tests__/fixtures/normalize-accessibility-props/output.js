import {
  normalizeAccessibilityProps as _normalizeAccessibilityProps,
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
/>;
