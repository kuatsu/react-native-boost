import { NativeView as _NativeView } from 'react-native-boost/runtime';
import { View } from 'react-native';
<>
  <View id={dynamicId} nativeID="y">
    <NotOptimized />
  </View>
  {/* @boost-force */}
  <_NativeView nativeID={dynamicId}>
    <ForceOptimized />
  </_NativeView>
</>;
