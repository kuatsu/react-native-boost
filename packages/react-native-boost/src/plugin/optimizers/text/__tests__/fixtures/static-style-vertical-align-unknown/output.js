import {
  processTextStyle as _processTextStyle,
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
<_NativeText
  {..._processTextStyle({
    verticalAlign: 'sideways',
  })}
  allowFontScaling={true}
  ellipsizeMode={'tail'}
  accessible={_getDefaultTextAccessible()}
/>;
