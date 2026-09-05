import {
  getDefaultTextStyle as _getDefaultTextStyle,
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
import { Link as RouterLink } from 'expo-router';
<>
  <RouterLink asChild>
    <Text>This should NOT be optimized due to aliased Link asChild</Text>
  </RouterLink>
  <RouterLink>
    <_NativeText
      style={_getDefaultTextStyle() ? [_getDefaultTextStyle(), void 0] : void 0}
      allowFontScaling={true}
      ellipsizeMode={'tail'}
      accessible={_getDefaultTextAccessible()}>
      Direct child of aliased Link without asChild
    </_NativeText>
  </RouterLink>
</>;
