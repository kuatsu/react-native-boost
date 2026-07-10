import { Image } from 'react-native';

<Image
  source={{ uri: 'logo.png', width: 16, height: 16 }}
  blurRadius={2}
  resizeMethod="resize"
  resizeMultiplier={2}
  progressiveRenderingEnabled={true}
  fadeDuration={0}
  capInsets={{ top: 1, left: 2, bottom: 3, right: 4 }}
/>;
