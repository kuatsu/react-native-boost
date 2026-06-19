import {
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text, View } from 'react-native';
import { Link } from 'expo-router';
<Link asChild href="/home">
  <View>
    <_NativeText allowFontScaling={true} ellipsizeMode={'tail'} accessible={_getDefaultTextAccessible()}>
      This should be optimized because View is the direct child
    </_NativeText>
  </View>
</Link>;
