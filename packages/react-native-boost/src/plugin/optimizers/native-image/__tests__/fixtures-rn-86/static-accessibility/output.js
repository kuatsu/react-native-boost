import {
  NativeImage as _NativeImage,
  processImageAccessibilityProps as _processImageAccessibilityProps,
} from 'react-native-boost/runtime';
import { Image } from 'react-native';
const _imageSource = [
    {
      uri: 'logo.png',
      headers: {},
    },
  ],
  _imageSource2 = [
    {
      uri: 'logo.png',
      headers: {},
    },
  ],
  _imageSource3 = [
    {
      uri: 'logo.png',
      headers: {},
    },
  ];
<_NativeImage
  alt="Fallback"
  aria-label="Winner"
  accessibilityState={{
    disabled: false,
  }}
  accessibilityLabel="Winner"
  accessible={false}
  style={[
    {},
    {
      overflow: 'hidden',
    },
  ]}
  source={_imageSource}
  resizeMode="cover"
/>;
<_NativeImage
  alt={null}
  accessible={true}
  accessibilityState={void 0}
  accessibilityLabel={null}
  style={[
    {},
    {
      overflow: 'hidden',
    },
  ]}
  source={_imageSource2}
  resizeMode="cover"
/>;
<_NativeImage
  {..._processImageAccessibilityProps({
    'alt': 'Fallback',
    'aria-label': label,
    'aria-busy': true,
  })}
  style={[
    {},
    {
      overflow: 'hidden',
    },
  ]}
  source={_imageSource3}
  resizeMode="cover"
/>;
