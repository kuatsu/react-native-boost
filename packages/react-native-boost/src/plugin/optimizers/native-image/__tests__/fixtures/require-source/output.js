import {
  processImageSourceProps as _processImageSourceProps,
  NativeImage as _NativeImage,
} from 'react-native-boost/runtime';
import { Image } from 'react-native';
<_NativeImage
  {..._processImageSourceProps({
    source: require('./logo.png'),
  })}
/>;
