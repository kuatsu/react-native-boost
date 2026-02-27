import { Text } from 'react-native';
import { Link } from 'expo-router';

<>
  <Link asChild={false}>
    <Text>This should be optimized because asChild is false</Text>
  </Link>
  <Link asChild={true}>
    <Text>This should NOT be optimized because asChild is true</Text>
  </Link>
</>;
