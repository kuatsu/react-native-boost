import { NativeText as _NativeText } from 'react-native-boost/runtime';
import { Text } from 'react-native';
import { Link as RouterLink } from 'expo-router';
<>
  <_NativeText allowFontScaling={true} ellipsizeMode={'tail'}>
    This should be optimized
  </_NativeText>
  <RouterLink asChild>
    <Text>This should NOT be optimized due to aliased Link asChild</Text>
  </RouterLink>
  <RouterLink>
    <_NativeText allowFontScaling={true} ellipsizeMode={'tail'}>
      This should be optimized (aliased Link without asChild)
    </_NativeText>
  </RouterLink>
</>;
