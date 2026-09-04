import { NativeView as _NativeView } from 'react-native-boost/runtime';
import { Text, View } from 'react-native';
const Card = ({ children }) => (
  <View>
    <Text>Title</Text>
    {children}
  </View>
);
<Card>
  <_NativeView />
</Card>;
