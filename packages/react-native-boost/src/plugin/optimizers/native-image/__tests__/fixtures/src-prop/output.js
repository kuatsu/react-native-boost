import {
  processImageSourceProps as _processImageSourceProps,
  NativeImage as _NativeImage,
} from 'react-native-boost/runtime';
import { Image } from 'react-native';
<_NativeImage
  {..._processImageSourceProps({
    src: 'https://example.com/a.png',
    width: 10,
    height: 20,
  })}
/>;
