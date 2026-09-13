import {
  processImageSourceProps as _processImageSourceProps,
  NativeImage as _NativeImage,
} from 'react-native-boost/runtime';
import { Image } from 'react-native';
<_NativeImage
  {..._processImageSourceProps({
    source: {
      uri: 'source.png',
      width: 16,
      height: 16,
    },
    src: 'https://example.com/src.png',
    width: 20,
  })}
/>;
