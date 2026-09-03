import { View } from 'react-native';
<>
  <View id={dynamicId} nativeID="y">
    <NotOptimized />
  </View>
  {/* @boost-force */}
  <View id={dynamicId} nativeID="y">
    <ForceOptimized />
  </View>
</>;
