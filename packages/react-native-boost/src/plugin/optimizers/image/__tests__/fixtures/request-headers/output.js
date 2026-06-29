import { NativeImage as _NativeImage } from 'react-native-boost/runtime';
import { Image } from 'react-native';
<_NativeImage
  style={[
    {},
    {
      overflow: 'hidden',
    },
  ]}
  source={[
    {
      uri: 'https://example.com/logo.png',
      headers: {
        'Access-Control-Allow-Credentials': 'true',
        'Referrer-Policy': 'no-referrer',
      },
      width: 16,
      height: 16,
    },
  ]}
  resizeMode="cover"
/>;
<_NativeImage
  style={[
    {},
    {
      overflow: 'hidden',
    },
  ]}
  source={[
    {
      uri: 'logo.png',
      width: 16,
      height: 16,
      headers: {
        'Access-Control-Allow-Credentials': 'true',
        'Referrer-Policy': 'origin',
      },
    },
  ]}
  resizeMode="cover"
/>;
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
      uri: '',
      width: 16,
      height: 16,
    },
  ]}
  resizeMode="cover"
/>;
