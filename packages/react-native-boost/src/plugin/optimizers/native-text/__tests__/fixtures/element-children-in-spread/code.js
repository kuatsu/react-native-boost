import { Text, View } from 'react-native';

const props = { children: <Text>nested</Text> };
<View>
  <Text {...props} />
</View>;
