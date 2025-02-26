import { NativeView as _NativeView } from 'react-native-boost/runtime';
import { View } from 'react-native';
<>
  <_NativeView>
    <Optimized />
  </_NativeView>
  {/* @boost-ignore */}
  <View>
    <NotOptimized />
  </View>
</>;
