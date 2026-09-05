import {
  processTextStyle as _processTextStyle,
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
<_NativeText
  selectable={false}
  allowFontScaling={true}
  ellipsizeMode={'tail'}
  {..._processTextStyle({
    userSelect: 'text',
    color: 'red',
  })}
  accessible={_getDefaultTextAccessible()}
/>;
