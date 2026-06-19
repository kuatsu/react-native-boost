import {
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
import * as ExpoRouter from 'expo-router';
<>
  <ExpoRouter.Link asChild href="/home">
    <Text>This should NOT be optimized for namespace Link asChild</Text>
  </ExpoRouter.Link>
  <ExpoRouter.Link href="/home">
    <_NativeText allowFontScaling={true} ellipsizeMode={'tail'} accessible={_getDefaultTextAccessible()}>
      This should be optimized without asChild
    </_NativeText>
  </ExpoRouter.Link>
</>;
