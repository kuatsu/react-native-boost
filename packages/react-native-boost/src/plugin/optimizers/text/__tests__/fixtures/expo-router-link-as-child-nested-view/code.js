import { Text, View } from 'react-native';
import { Link } from 'expo-router';

<Link asChild href="/home">
  <View>
    <Text>This should be optimized because View is the direct child</Text>
  </View>
</Link>;
