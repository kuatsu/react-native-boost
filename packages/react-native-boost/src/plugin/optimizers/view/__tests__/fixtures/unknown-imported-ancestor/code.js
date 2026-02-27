import { View } from 'react-native';
import { ExternalWrapper } from './ExternalWrapper';
<>
  <View>
    <Optimized />
  </View>
  <ExternalWrapper>
    <View>
      <NotOptimized />
    </View>
  </ExternalWrapper>
</>;
