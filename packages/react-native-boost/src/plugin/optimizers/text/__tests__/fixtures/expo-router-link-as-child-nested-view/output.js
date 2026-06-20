import { Text, View } from 'react-native';
import { Link } from 'expo-router';
<Link asChild href="/home">
  <View>
    <Text>Inside a View under an asChild Link</Text>
  </View>
</Link>;
