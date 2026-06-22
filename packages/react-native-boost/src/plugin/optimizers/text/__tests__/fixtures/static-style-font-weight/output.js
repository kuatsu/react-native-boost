import {
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
<_NativeText
  style={{
    fontWeight: '700',
  }}
  allowFontScaling={true}
  ellipsizeMode={'tail'}
  accessible={_getDefaultTextAccessible()}
/>;
