import { NativeView as _NativeView } from 'react-native-boost/runtime';
import { View } from 'react-native';
import { ExternalWrapper } from './ExternalWrapper';
<>
  <_NativeView>
    <Optimized />
  </_NativeView>
  <ExternalWrapper>
    <View>
      <NotOptimized />
    </View>
  </ExternalWrapper>
</>;
