import {
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
import { Link } from 'expo-router';
<>
  <Link asChild={false}>
    <_NativeText allowFontScaling={true} ellipsizeMode={'tail'} accessible={_getDefaultTextAccessible()}>
      Direct child of Link with asChild false
    </_NativeText>
  </Link>
  <Link asChild={true}>
    <Text>This should NOT be optimized because asChild is true</Text>
  </Link>
</>;
