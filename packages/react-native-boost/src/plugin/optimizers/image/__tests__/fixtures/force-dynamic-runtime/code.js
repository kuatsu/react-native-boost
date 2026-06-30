import { Image } from 'react-native';

<>
  {/* @boost-force */}
  <Image source={source} />
  {/* @boost-force */}
  <Image source={{ uri: 'logo.png', width: 16, height: 16 }} style={style} />
</>;
