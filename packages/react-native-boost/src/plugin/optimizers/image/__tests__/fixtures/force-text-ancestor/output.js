import { NativeImage as _NativeImage } from 'react-native-boost/runtime';
import { Image, Text } from 'react-native';
const _imageSource = [
  {
    uri: 'forced.png',
    width: 16,
    height: 16,
  },
];
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
    source={_imageSource}
    resizeMode="cover"
  />
</Text>;
