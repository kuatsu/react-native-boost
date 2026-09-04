import { NativeImage as _NativeImage } from 'react-native-boost/runtime';
import { Image } from 'react-native';
const _imageSource = [
  {
    uri: 'logo.png',
  },
];
<>
  {/* @boost-force */}
  <_NativeImage
    style={[
      {},
      {
        overflow: 'hidden',
      },
    ]}
    source={_imageSource}
    resizeMode="cover">
    <Child />
  </_NativeImage>
</>;
