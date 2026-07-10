import { Image } from 'react-native';
const props = {
  'aria-label': 'Logo',
};
<Image
  source={{
    uri: 'logo.png',
    width: 16,
    height: 16,
  }}
  {...props}
/>;
