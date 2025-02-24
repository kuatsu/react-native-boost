import { NativeView as _NativeView } from 'react-native-boost';
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
