import { NativeView as _NativeView } from 'react-native-boost';
import { Text, View } from 'react-native';
const Custom = ({ children }) => {
  return <Text>{children}</Text>;
};
<>
  <_NativeView>
    <Optimized />
  </_NativeView>
  <Custom>
    <View>
      <NotOptimized />
    </View>
  </Custom>
</>;
