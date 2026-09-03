import { NativeImage as _NativeImage } from 'react-native-boost/runtime';
import { Image } from 'react-native';
const _imageSource = [
  {
    uri: 'https://example.com/src.png',
    headers: {},
    width: 20,
  },
];
<_NativeImage
  style={[
    {},
    {
      overflow: 'hidden',
    },
  ]}
  source={_imageSource}
  resizeMode="cover"
/>;
