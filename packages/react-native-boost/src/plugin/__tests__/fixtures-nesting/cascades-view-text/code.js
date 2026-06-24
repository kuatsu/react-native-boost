import { Text, View } from 'react-native';
const C = () => (
  <View style={{ flex: 1 }}>
    <Text>top</Text>
    <View style={{ gap: 4 }}>
      <Text>deep</Text>
    </View>
  </View>
);
