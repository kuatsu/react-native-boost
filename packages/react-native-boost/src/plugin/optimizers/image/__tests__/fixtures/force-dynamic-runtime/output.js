import {
  processImageSourceProps as _processImageSourceProps,
  NativeImage as _NativeImage,
} from 'react-native-boost/runtime';
import { Image } from 'react-native';
<>
  {/* @boost-force */}
  <_NativeImage
    {..._processImageSourceProps({
      source: source,
    })}
  />
  {/* @boost-force */}
  <_NativeImage
    {..._processImageSourceProps({
      source: {
        uri: 'logo.png',
        width: 16,
        height: 16,
      },
      style: style,
    })}
  />
</>;
