import _NativeView from 'react-native/Libraries/Components/View/ViewNativeComponent';
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
