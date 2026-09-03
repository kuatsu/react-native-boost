import { Text } from 'react-native';
<>
  <Text
    onPress={() => {
      console.log('pressed');
    }}>
    Normally skipped due to blacklisted prop
  </Text>
  {/* @boost-force */}
  <Text
    onPress={() => {
      console.log('pressed');
    }}>
    Force optimized despite blacklisted prop
  </Text>
</>;
