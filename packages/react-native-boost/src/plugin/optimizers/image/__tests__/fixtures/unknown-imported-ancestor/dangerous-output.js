import { NativeImage as _NativeImage } from 'react-native-boost/runtime';
import { Image } from 'react-native';
import { ExternalWrapper } from './ExternalWrapper';
const _imageSource = [
    {
      uri: 'safe.png',
      width: 16,
      height: 16,
    },
  ],
  _imageSource2 = [
    {
      uri: 'unknown.png',
      width: 16,
      height: 16,
    },
  ];
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
    source={_imageSource}
    resizeMode="cover"
  />
  <ExternalWrapper>
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
      source={_imageSource2}
      resizeMode="cover"
    />
  </ExternalWrapper>
</>;
