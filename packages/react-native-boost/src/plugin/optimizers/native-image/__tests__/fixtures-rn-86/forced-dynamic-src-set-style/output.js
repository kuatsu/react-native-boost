import {
  processImageSourceProps as _processImageSourceProps,
  NativeImage as _NativeImage,
} from 'react-native-boost/runtime';
import { Image } from 'react-native';
<>
  {/* @boost-force */}
  <_NativeImage
    srcSet="logo.png 1x"
    {..._processImageSourceProps({
      style: styles.image,
    })}
  />
</>;
