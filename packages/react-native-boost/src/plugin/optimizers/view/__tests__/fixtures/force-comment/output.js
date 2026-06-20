import { NativeView as _NativeView } from 'react-native-boost/runtime';
import { View } from 'react-native';
<>
  <View aria-label="x">
    <NotOptimized />
  </View>
  {/* @boost-force */}
  <_NativeView aria-label="x">
    <ForceOptimized />
  </_NativeView>
</>;
