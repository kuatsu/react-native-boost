import { Text } from 'react-native';
import { Link as RouterLink } from 'expo-router';

<>
  <Text>This should be optimized</Text>
  <RouterLink asChild>
    <Text>This should NOT be optimized due to aliased Link asChild</Text>
  </RouterLink>
  <RouterLink>
    <Text>This should be optimized (aliased Link without asChild)</Text>
  </RouterLink>
</>;
