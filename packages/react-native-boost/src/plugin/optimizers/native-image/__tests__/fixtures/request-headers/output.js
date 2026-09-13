import {
  processImageSourceProps as _processImageSourceProps,
  NativeImage as _NativeImage,
} from 'react-native-boost/runtime';
import { Image } from 'react-native';
const _imageSource = [
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
  _imageSource2 = [
    {
      uri: '',
      width: 16,
      height: 16,
    },
  ];
<_NativeImage
  {..._processImageSourceProps({
    src: 'https://example.com/logo.png',
    width: 16,
    height: 16,
    crossOrigin: 'use-credentials',
    referrerPolicy: 'no-referrer',
  })}
/>;
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
    {
      width: 16,
      height: 16,
    },
    {
      overflow: 'hidden',
    },
  ]}
  source={_imageSource2}
  resizeMode="cover"
/>;
