import { NativeImage as _NativeImage } from 'react-native-boost/runtime';
import { Image } from 'react-native';
const _imageSource = [
  {
    headers: {},
    scale: 1,
    uri: 'logo.png',
  },
];
<_NativeImage
  testID={'logo'}
  style={[
    {},
    {
      overflow: 'hidden',
    },
  ]}
  source={_imageSource}
  resizeMode="cover"
/>;
