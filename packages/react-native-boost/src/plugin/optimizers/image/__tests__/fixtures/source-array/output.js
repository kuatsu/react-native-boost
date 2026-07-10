import { NativeImage as _NativeImage } from 'react-native-boost/runtime';
import { Image } from 'react-native';
<_NativeImage
  width={16}
  height={16}
  style={[
    {},
    {
      overflow: 'hidden',
    },
    {
      opacity: 0.9,
    },
  ]}
  source={[
    {
      uri: 'logo.png',
      width: 16,
      height: 16,
      scale: 1,
    },
    {
      uri: 'logo@2x.png',
      width: 32,
      height: 32,
      scale: 2,
    },
  ]}
  resizeMode="cover"
/>;
