import { Text, View } from 'react-native';

const Card = ({ children }) => (
  <View>
    <Text>Title</Text>
    {children}
  </View>
);

<Card>
  <View />
</Card>;
