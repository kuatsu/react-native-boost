import { NativeImage as _NativeImage } from 'react-native-boost/runtime';
import { Image } from 'react-native';
const _imageSource = [
  {
    uri: 'https://example.com/a.png',
    headers: {},
    width: 10,
    height: 20,
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
