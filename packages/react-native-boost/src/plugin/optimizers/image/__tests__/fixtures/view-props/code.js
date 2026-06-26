import { Image } from 'react-native';

<Image
  source={{ uri: 'logo.png', width: 16, height: 16 }}
  accessible={true}
  accessibilityLabel="logo"
  accessibilityRole="image"
  accessibilityHint="opens logo"
  accessibilityValue={{ text: 'loaded' }}
  accessibilityState={{ selected: true }}
  nativeID="logo"
  pointerEvents="none"
  collapsable={false}
  onLayout={() => {}}
  borderRadius={4}
  borderTopLeftRadius={1}
  borderTopRightRadius={2}
  borderBottomLeftRadius={3}
  borderBottomRightRadius={4}
/>;
