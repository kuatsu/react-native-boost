import { Image, Text } from 'react-native';

<Text>
  <Image source={{ uri: 'logo.png', width: 16, height: 16 }} />
  {/* @boost-force */}
  <Image source={{ uri: 'forced.png', width: 16, height: 16 }} />
</Text>;
