import { NativeImage as _NativeImage } from 'react-native-boost/runtime';
import { Image } from 'react-native';
<_NativeImage
  testID="logo"
  style={[
    {
      width: 24,
      height: 16,
    },
    {
      overflow: 'hidden',
    },
  ]}
  source={[
    {
      uri: 'logo.png',
      width: 24,
      height: 16,
    },
  ]}
  resizeMode="cover"
/>;
