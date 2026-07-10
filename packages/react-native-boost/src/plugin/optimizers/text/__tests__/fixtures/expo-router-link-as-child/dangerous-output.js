import {
  getDefaultTextStyle as _getDefaultTextStyle,
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
import { Link } from 'expo-router';
<>
  <_NativeText
    style={_getDefaultTextStyle()}
    allowFontScaling={true}
    ellipsizeMode={'tail'}
    accessible={_getDefaultTextAccessible()}>
    This should be optimized
  </_NativeText>
  <Link asChild>
    <Text>This should NOT be optimized due to Link asChild</Text>
  </Link>
  <Link>
    <_NativeText
      style={_getDefaultTextStyle()}
      allowFontScaling={true}
      ellipsizeMode={'tail'}
      accessible={_getDefaultTextAccessible()}>
      Direct child of Link without asChild
    </_NativeText>
  </Link>
  <Link href="/home" asChild>
    <Text>This should NOT be optimized (Link with href and asChild)</Text>
  </Link>
</>;
