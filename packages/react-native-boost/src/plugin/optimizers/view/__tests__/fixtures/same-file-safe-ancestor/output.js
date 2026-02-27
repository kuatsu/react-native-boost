import { NativeView as _NativeView } from 'react-native-boost/runtime';
import { View } from 'react-native';
const Wrapper = ({ children }) => <>{children}</>;
<Wrapper>
  <_NativeView>
    <Optimized />
  </_NativeView>
</Wrapper>;
