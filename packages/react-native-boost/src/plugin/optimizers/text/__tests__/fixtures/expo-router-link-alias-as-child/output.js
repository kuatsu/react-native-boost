import {
  getDefaultTextStyle as _getDefaultTextStyle,
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
import { Link as RouterLink } from 'expo-router';
<>
  <_NativeText
    style={_getDefaultTextStyle()}
    allowFontScaling={true}
    ellipsizeMode={'tail'}
    accessible={_getDefaultTextAccessible()}>
    This should be optimized
  </_NativeText>
  <RouterLink asChild>
    <Text>This should NOT be optimized due to aliased Link asChild</Text>
  </RouterLink>
  <RouterLink>
    <Text>Direct child of aliased Link without asChild</Text>
  </RouterLink>
</>;
