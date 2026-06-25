import { NativeImage as _NativeImage } from 'react-native-boost/runtime';
import { Image } from 'react-native';
<_NativeImage
  style={[
    {
      width: 10,
      height: 20,
    },
    {
      overflow: 'hidden',
    },
  ]}
  source={[
    {
      uri: 'https://example.com/a.png',
      headers: {},
      width: 10,
      height: 20,
    },
  ]}
  resizeMode="cover"
/>;
