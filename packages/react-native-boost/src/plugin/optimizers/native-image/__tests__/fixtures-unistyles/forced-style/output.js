import {
  processImageSourceProps as _processImageSourceProps,
  NativeImage as _NativeImage,
} from 'react-native-boost/runtime';
import { Image } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
const styles = StyleSheet.create({
  image: {
    width: 16,
  },
});
<>
  {/* @boost-force */}
  <_NativeImage
    {..._processImageSourceProps({
      source: {
        uri: 'logo.png',
      },
      style: styles.image,
    })}
  />
</>;
