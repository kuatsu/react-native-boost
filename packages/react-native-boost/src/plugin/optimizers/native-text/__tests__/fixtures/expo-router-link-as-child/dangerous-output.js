import {
  getDefaultTextStyle as _getDefaultTextStyle,
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
import { Link } from 'expo-router';
<>
  <Link asChild>
    <Text>This should NOT be optimized due to Link asChild</Text>
  </Link>
  <Link>
    <_NativeText
      style={_getDefaultTextStyle() ? [_getDefaultTextStyle(), void 0] : void 0}
      allowFontScaling={true}
      ellipsizeMode={'tail'}
      accessible={_getDefaultTextAccessible()}>
      Direct child of Link without asChild
    </_NativeText>
  </Link>
</>;
