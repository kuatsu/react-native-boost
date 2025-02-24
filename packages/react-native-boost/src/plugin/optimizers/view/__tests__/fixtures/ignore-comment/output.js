import { NativeView as _NativeView } from 'react-native-boost';
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
