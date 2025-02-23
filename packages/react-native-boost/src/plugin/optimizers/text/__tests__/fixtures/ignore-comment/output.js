import { NativeText as _NativeText } from 'react-native/Libraries/Text/TextNativeComponent';
import { Text } from 'react-native';
<>
  <_NativeText>Optimize this</_NativeText>
  {/* @boost-ignore */}
  <Text>But don't optimize this</Text>
</>;
