import { NativeImage as _NativeImage } from 'react-native-boost/runtime';
import { Image } from 'react-native';
<_NativeImage
  blurRadius={2}
  resizeMethod="resize"
  resizeMultiplier={2}
  progressiveRenderingEnabled={true}
  fadeDuration={0}
  capInsets={{
    top: 1,
    left: 2,
    bottom: 3,
    right: 4,
  }}
  style={[
    {
      width: 16,
      height: 16,
    },
    {
      overflow: 'hidden',
    },
  ]}
  source={[
    {
      uri: 'logo.png',
      width: 16,
      height: 16,
    },
  ]}
  resizeMode="cover"
/>;
