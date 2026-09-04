import {
  processImageSourceProps as _processImageSourceProps,
  NativeImage as _NativeImage,
} from 'react-native-boost/runtime';
import { Image, StyleSheet } from 'react-native';
const styles = StyleSheet.create({
  image: {
    width: 16,
  },
});
<_NativeImage
  {..._processImageSourceProps({
    source: {
      uri: 'logo.png',
    },
    style: styles.image,
  })}
/>;
