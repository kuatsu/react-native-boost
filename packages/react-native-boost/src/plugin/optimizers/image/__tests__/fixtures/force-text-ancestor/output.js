import { NativeImage as _NativeImage } from 'react-native-boost/runtime';
import { Image, Text } from 'react-native';
<Text>
  <Image
    source={{
      uri: 'logo.png',
      width: 16,
      height: 16,
    }}
  />
  {/* @boost-force */}
  <_NativeImage
    style={[
      {
        width: 16,
        height: 16,
      },
      {
        overflow: 'hidden',
      },
    ]}
    source={[
      {
        uri: 'forced.png',
        width: 16,
        height: 16,
      },
    ]}
    resizeMode="cover"
  />
</Text>;
