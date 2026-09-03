import { NativeImage as _NativeImage } from 'react-native-boost/runtime';
import { Image } from 'react-native';
const _imageSource = [
    {
      uri: 'logo.png',
      width: null,
      height: 12,
    },
  ],
  _imageSource2 = [
    {
      uri: 'logo.png',
      width: 16,
      height: 16,
    },
  ],
  _imageSource3 = [
    {
      uri: 'logo.png',
      width: 16,
      height: 16,
    },
  ],
  _imageSource4 = [
    {
      uri: 'logo.png',
      width: 16,
      height: 16,
    },
  ],
  _imageSource5 = [
    {
      uri: 'logo.png',
      width: 16,
      height: 16,
    },
  ];
<_NativeImage
  style={[
    {
      width: 16,
      height: 12,
    },
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
    {
      resizeMode: 'contain',
    },
  ]}
  source={_imageSource2}
  resizeMode="contain"
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
    {
      resizeMode: 'contain',
    },
  ]}
  source={_imageSource3}
  resizeMode="contain"
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
    {
      objectFit: 'fill',
    },
  ]}
  source={_imageSource4}
  resizeMode="stretch"
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
    {
      tintColor: 'red',
    },
  ]}
  source={_imageSource5}
  resizeMode="cover"
  tintColor="red"
/>;
