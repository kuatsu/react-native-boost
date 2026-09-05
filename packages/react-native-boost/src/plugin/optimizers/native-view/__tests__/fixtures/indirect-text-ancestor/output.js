import { NativeView as _NativeView, NativeViewWithContext as _NativeViewWithContext } from 'react-native-boost/runtime';
import { Text, View } from 'react-native';
const Custom = ({ children }) => {
  return <Text>{children}</Text>;
};
<>
  <_NativeView>
    <Optimized />
  </_NativeView>
  <Custom>
    <_NativeViewWithContext>
      <NotOptimized />
    </_NativeViewWithContext>
  </Custom>
</>;
