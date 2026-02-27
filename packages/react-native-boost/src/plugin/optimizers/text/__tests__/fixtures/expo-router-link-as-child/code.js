import { Text } from 'react-native';
import { Link } from 'expo-router';

<>
  <Text>This should be optimized</Text>
  <Link asChild>
    <Text>This should NOT be optimized due to Link asChild</Text>
  </Link>
  <Link>
    <Text>This should be optimized (Link without asChild)</Text>
  </Link>
  <Link href="/home" asChild>
    <Text>This should NOT be optimized (Link with href and asChild)</Text>
  </Link>
</>;
