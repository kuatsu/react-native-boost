import {
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
<_NativeText
  style={{
    color: 'red',
  }}
  allowFontScaling={true}
  ellipsizeMode={'tail'}
  selectable={false}
  accessible={_getDefaultTextAccessible()}
/>;
