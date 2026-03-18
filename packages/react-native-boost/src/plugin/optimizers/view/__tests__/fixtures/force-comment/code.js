import { View } from 'react-native';
<>
  <View style={{ flex: 1 }}>
    <NotOptimized />
  </View>
  {/* @boost-force */}
  <View style={{ flex: 1 }}>
    <ForceOptimized />
  </View>
</>;
