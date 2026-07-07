import { NativeImage as _NativeImage } from 'react-native-boost/runtime';
import { Image } from 'react-native';
import { ExternalWrapper } from './ExternalWrapper';
<>
  <_NativeImage
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
        uri: 'safe.png',
        width: 16,
        height: 16,
      },
    ]}
    resizeMode="cover"
  />
  <ExternalWrapper>
    <Image
      source={{
        uri: 'unknown.png',
        width: 16,
        height: 16,
      }}
    />
  </ExternalWrapper>
</>;
