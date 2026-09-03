import { NativeImage as _NativeImage } from 'react-native-boost/runtime';
import { Image } from 'react-native';
const _imageSource = [
  {
    uri: 'logo.png',
    width: 16,
    height: 16,
  },
];
<_NativeImage
  accessible={true}
  accessibilityLabel="logo"
  accessibilityRole="image"
  accessibilityHint="opens logo"
  accessibilityValue={{
    text: 'loaded',
  }}
  accessibilityState={{
    selected: true,
  }}
  nativeID="logo"
  pointerEvents="none"
  collapsable={false}
  onLayout={() => {}}
  borderRadius={4}
  borderTopLeftRadius={1}
  borderTopRightRadius={2}
  borderBottomLeftRadius={3}
  borderBottomRightRadius={4}
  style={[
    {
      width: 16,
      height: 16,
    },
    {
      overflow: 'hidden',
    },
  ]}
  source={_imageSource}
  resizeMode="cover"
/>;
