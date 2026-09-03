import { Image } from 'react-native';

<Image
  src="https://example.com/logo.png"
  width={16}
  height={16}
  crossOrigin="use-credentials"
  referrerPolicy="no-referrer"
/>;

<Image source={{ uri: 'logo.png', width: 16, height: 16 }} crossOrigin="use-credentials" referrerPolicy="origin" />;

<Image source={{ uri: '', width: 16, height: 16 }} referrerPolicy="origin" />;
