import { NativeView as _NativeView } from 'react-native-boost/runtime';
import { View } from 'react-native';
import { ExternalWrapper } from './ExternalWrapper';
<>
  <_NativeView>
    <Optimized />
  </_NativeView>
  <ExternalWrapper>
    <_NativeView>
      <NotOptimized />
    </_NativeView>
  </ExternalWrapper>
</>;
