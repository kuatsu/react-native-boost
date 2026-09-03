import { NativeImage as _NativeImage } from 'react-native-boost/runtime';
import { Image } from 'react-native';
const _imageSource = [
  {
    uri: 'hero.png',
  },
];
<_NativeImage
  style={[
    {},
    {
      overflow: 'hidden',
    },
    [
      {
        width: 100,
        tintColor: 'red',
      },
      {
        objectFit: 'fill',
      },
    ],
  ]}
  source={_imageSource}
  resizeMode="stretch"
  tintColor="red"
/>;
