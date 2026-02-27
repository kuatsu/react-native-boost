import { NativeText as _NativeText } from 'react-native-boost/runtime';
import { Text } from 'react-native';
import { Link } from 'expo-router';
<>
  <Link asChild={false}>
    <_NativeText allowFontScaling={true} ellipsizeMode={'tail'}>
      This should be optimized because asChild is false
    </_NativeText>
  </Link>
  <Link asChild={true}>
    <Text>This should NOT be optimized because asChild is true</Text>
  </Link>
</>;
