import {
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
import { HStack, Body, Card } from '@beedeez/front-common-design-system';
<>
  <HStack spacing="xs">
    <_NativeText allowFontScaling={true} ellipsizeMode={'tail'} accessible={_getDefaultTextAccessible()}>
      under view wrapper
    </_NativeText>
  </HStack>
  <Body>
    <Text>under text wrapper</Text>
  </Body>
  <Card>
    <Text>under unregistered wrapper</Text>
  </Card>
</>;
