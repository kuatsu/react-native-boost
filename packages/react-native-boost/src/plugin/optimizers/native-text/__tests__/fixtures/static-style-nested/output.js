import {
  processTextStyle as _processTextStyle,
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
<_NativeText
  allowFontScaling={true}
  ellipsizeMode={'tail'}
  {..._processTextStyle({
    shadowOffset: {
      width: 1,
      height: 1,
    },
    transform: [
      {
        scale: 2,
      },
    ],
  })}
  accessible={_getDefaultTextAccessible()}
/>;
