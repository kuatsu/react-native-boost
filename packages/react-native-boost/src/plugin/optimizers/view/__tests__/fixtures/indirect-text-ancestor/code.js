import { Text, View } from 'react-native';
const Custom = ({ children }) => {
  return <Text>{children}</Text>;
};
<>
  <View>
    <Optimized />
  </View>
  <Custom>
    <View>
      <NotOptimized />
    </View>
  </Custom>
</>;
