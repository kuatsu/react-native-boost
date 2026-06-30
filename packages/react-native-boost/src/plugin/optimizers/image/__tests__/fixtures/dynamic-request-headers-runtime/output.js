import {
  processImageSourceProps as _processImageSourceProps,
  NativeImage as _NativeImage,
} from 'react-native-boost/runtime';
import { Image } from 'react-native';
const policy = getPolicy();
<_NativeImage
  {..._processImageSourceProps({
    src: 'https://example.com/logo.png',
    width: 16,
    height: 16,
    crossOrigin: 'use-credentials',
    referrerPolicy: policy,
  })}
/>;
