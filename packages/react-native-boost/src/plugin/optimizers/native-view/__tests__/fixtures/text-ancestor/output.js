import { NativeView as _NativeView, NativeViewWithContext as _NativeViewWithContext } from 'react-native-boost/runtime';
import { Text, View } from 'react-native';
<>
  <_NativeView>
    <Optimized />
  </_NativeView>
  <Text>
    <_NativeViewWithContext>
      <NotOptimized />
    </_NativeViewWithContext>
  </Text>
</>;
