import { NativeView as _NativeView } from 'react-native-boost/runtime';
import { View } from 'react-native';
<>
  <View
    style={{
      flex: 1,
    }}>
    <NotOptimized />
  </View>
  {/* @boost-force */}
  <_NativeView
    style={{
      flex: 1,
    }}>
    <ForceOptimized />
  </_NativeView>
</>;
