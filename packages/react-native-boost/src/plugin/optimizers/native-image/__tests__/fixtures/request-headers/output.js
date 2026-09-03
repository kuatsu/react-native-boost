import { NativeImage as _NativeImage } from 'react-native-boost/runtime';
import { Image } from 'react-native';
const _imageSource = [
    {
      uri: 'https://example.com/logo.png',
      headers: {
        'Access-Control-Allow-Credentials': 'true',
        'Referrer-Policy': 'no-referrer',
      },
      width: 16,
      height: 16,
    },
  ],
  _imageSource2 = [
    {
      uri: 'logo.png',
      width: 16,
      height: 16,
      headers: {
        'Access-Control-Allow-Credentials': 'true',
        'Referrer-Policy': 'origin',
      },
    },
  ],
  _imageSource3 = [
    {
      uri: '',
      width: 16,
      height: 16,
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
<_NativeImage
  style={[
    {},
    {
      overflow: 'hidden',
    },
  ]}
  source={_imageSource2}
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
  source={_imageSource3}
  resizeMode="cover"
/>;
