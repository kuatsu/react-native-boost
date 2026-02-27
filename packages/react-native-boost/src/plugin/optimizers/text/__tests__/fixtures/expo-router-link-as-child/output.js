import { NativeText as _NativeText } from 'react-native-boost/runtime';
import { Text } from 'react-native';
import { Link } from 'expo-router';
<>
  <_NativeText allowFontScaling={true} ellipsizeMode={'tail'}>
    This should be optimized
  </_NativeText>
  <Link asChild>
    <Text>This should NOT be optimized due to Link asChild</Text>
  </Link>
  <Link>
    <_NativeText allowFontScaling={true} ellipsizeMode={'tail'}>
      This should be optimized (Link without asChild)
    </_NativeText>
  </Link>
  <Link href="/home" asChild>
    <Text>This should NOT be optimized (Link with href and asChild)</Text>
  </Link>
</>;
