import {
  getDefaultTextStyle as _getDefaultTextStyle,
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
<_NativeText
  style={[
    _getDefaultTextStyle(),
    {
      shadowOffset: {
        width: 1,
        height: 1,
      },
      transform: [
        {
          scale: 2,
        },
      ],
    },
  ]}
  allowFontScaling={true}
  ellipsizeMode={'tail'}
  accessible={_getDefaultTextAccessible()}
/>;
