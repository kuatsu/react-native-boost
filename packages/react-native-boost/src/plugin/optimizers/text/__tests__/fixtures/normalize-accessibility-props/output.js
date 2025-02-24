import { NativeText as _NativeText } from 'react-native/Libraries/Text/TextNativeComponent';
import { normalizeAccessibilityProps as _normalizeAccessibilityProps } from 'react-native-boost';
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
