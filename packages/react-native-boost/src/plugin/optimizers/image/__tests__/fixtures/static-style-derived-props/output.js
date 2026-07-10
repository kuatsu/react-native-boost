import { NativeImage as _NativeImage } from 'react-native-boost/runtime';
import { Image } from 'react-native';
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
  source={[
    {
      uri: 'hero.png',
    },
  ]}
  resizeMode="stretch"
  tintColor="red"
/>;
