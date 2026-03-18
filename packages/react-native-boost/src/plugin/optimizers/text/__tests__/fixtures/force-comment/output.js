import { NativeText as _NativeText } from 'react-native-boost/runtime';
import { Text } from 'react-native';
<>
  <Text
    onPress={() => {
      console.log('pressed');
    }}>
    Normally skipped due to blacklisted prop
  </Text>
  {/* @boost-force */}
  <_NativeText
    onPress={() => {
      console.log('pressed');
    }}
    allowFontScaling={true}
    ellipsizeMode={'tail'}>
    Force optimized despite blacklisted prop
  </_NativeText>
</>;
