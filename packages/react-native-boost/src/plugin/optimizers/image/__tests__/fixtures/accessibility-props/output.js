import {
  processImageAccessibilityProps as _processImageAccessibilityProps,
  NativeImage as _NativeImage,
} from 'react-native-boost/runtime';
import { Image } from 'react-native';
const label = getLabel();
const labelledBy = getLabelledBy();
<_NativeImage
  {..._processImageAccessibilityProps({
    alt: 'Logo',
    accessible: false,
    accessibilityLabel: 'Fallback',
  })}
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
<_NativeImage
  {..._processImageAccessibilityProps({
    'aria-label': label,
    'accessibilityLabel': 'Fallback',
    'alt': 'Alt',
  })}
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
<_NativeImage
  {..._processImageAccessibilityProps({
    'accessibilityState': {
      busy: false,
      checked: true,
    },
    'aria-busy': true,
    'aria-disabled': false,
  })}
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
<_NativeImage
  {..._processImageAccessibilityProps({
    'aria-hidden': true,
    'accessible': true,
    'importantForAccessibility': 'yes',
    'aria-labelledby': labelledBy,
    'accessibilityLabelledBy': 'fallback',
  })}
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
