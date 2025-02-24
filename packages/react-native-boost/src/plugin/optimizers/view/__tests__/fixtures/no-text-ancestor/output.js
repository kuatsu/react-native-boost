import _NativeView from 'react-native/Libraries/Components/View/ViewNativeComponent';
import { Text, View } from 'react-native';
<>
  <_NativeView>
    <Optimized />
  </_NativeView>
  <Text>
    <View>
      <NotOptimized />
    </View>
  </Text>
</>;
