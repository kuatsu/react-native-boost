import {
  processImageSourceProps as _processImageSourceProps,
  NativeImage as _NativeImage,
} from 'react-native-boost/runtime';
import { Image } from 'react-native';
<>
  {/* @boost-force */}
  <_NativeImage
    {..._processImageSourceProps({
      source: {
        uri: 'logo.png',
      },
      style: props.style,
    })}
  />
</>;
