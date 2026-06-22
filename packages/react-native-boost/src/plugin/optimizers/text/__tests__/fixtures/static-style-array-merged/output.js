import {
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
<_NativeText
  style={{
    color: 'red',
    fontSize: 16,
  }}
  allowFontScaling={true}
  ellipsizeMode={'tail'}
  accessible={_getDefaultTextAccessible()}
/>;
