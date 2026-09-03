import { Text } from 'react-native';
import { Link } from 'expo-router';
<>
  <Link asChild>
    <Text>This should NOT be optimized due to Link asChild</Text>
  </Link>
  <Link>
    <Text>Direct child of Link without asChild</Text>
  </Link>
</>;
