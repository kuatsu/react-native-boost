import { Text } from 'react-native';
import * as ExpoRouter from 'expo-router';

<>
  <ExpoRouter.Link asChild href="/home">
    <Text>This should NOT be optimized for namespace Link asChild</Text>
  </ExpoRouter.Link>
  <ExpoRouter.Link href="/home">
    <Text>This should be optimized without asChild</Text>
  </ExpoRouter.Link>
</>;
