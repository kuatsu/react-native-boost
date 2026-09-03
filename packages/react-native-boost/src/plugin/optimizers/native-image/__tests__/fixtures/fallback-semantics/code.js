import { Image } from 'react-native';

<Image source={{ uri: 'logo.png', width: null, height: 12 }} width={16} />;
<Image source={{ uri: 'logo.png', width: 16, height: 16 }} resizeMode={null} style={{ resizeMode: 'contain' }} />;
<Image source={{ uri: 'logo.png', width: 16, height: 16 }} resizeMode="" style={{ resizeMode: 'contain' }} />;
<Image source={{ uri: 'logo.png', width: 16, height: 16 }} resizeMode="contain" style={{ objectFit: 'fill' }} />;
<Image source={{ uri: 'logo.png', width: 16, height: 16 }} tintColor={null} style={{ tintColor: 'red' }} />;
