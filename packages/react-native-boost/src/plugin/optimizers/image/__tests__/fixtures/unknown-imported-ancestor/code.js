import { Image } from 'react-native';
import { ExternalWrapper } from './ExternalWrapper';

<>
  <Image source={{ uri: 'safe.png', width: 16, height: 16 }} />
  <ExternalWrapper>
    <Image source={{ uri: 'unknown.png', width: 16, height: 16 }} />
  </ExternalWrapper>
</>;
