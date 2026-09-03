import { Image } from 'react-native';

const policy = getPolicy();

<Image
  src="https://example.com/logo.png"
  width={16}
  height={16}
  crossOrigin="use-credentials"
  referrerPolicy={policy}
/>;
