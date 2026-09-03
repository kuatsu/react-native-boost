import { Image } from 'react-native';
const props = {
  source: {
    uri: 'override.png',
  },
};
const accessibilityProps = {
  alt: 'Logo',
};
<Image
  source={{
    uri: 'logo.png',
    width: 16,
    height: 16,
  }}
  {...props}
/>;
<Image
  source={{
    uri: 'logo.png',
    width: 16,
    height: 16,
  }}
  {...accessibilityProps}
/>;
