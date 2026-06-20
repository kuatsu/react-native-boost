import { View } from 'react-native';
<>
  <View aria-label="x">
    <NotOptimized />
  </View>
  {/* @boost-force */}
  <View aria-label="x">
    <ForceOptimized />
  </View>
</>;
