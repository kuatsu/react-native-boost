import { Image } from 'react-native';

<Image
  source={[
    { uri: 'logo.png', width: 16, height: 16, scale: 1 },
    { uri: 'logo@2x.png', width: 32, height: 32, scale: 2 },
  ]}
  width={16}
  height={16}
  style={{ opacity: 0.9 }}
/>;
