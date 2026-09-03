import { Image } from 'react-native';

const label = getLabel();
const labelledBy = getLabelledBy();

<Image
  source={{ uri: 'logo.png', width: 16, height: 16 }}
  alt="Logo"
  accessible={false}
  accessibilityLabel="Fallback"
/>;

<Image
  source={{ uri: 'logo.png', width: 16, height: 16 }}
  aria-label={label}
  accessibilityLabel="Fallback"
  alt="Alt"
/>;

<Image
  source={{ uri: 'logo.png', width: 16, height: 16 }}
  accessibilityState={{ busy: false, checked: true }}
  aria-busy={true}
  aria-disabled={false}
/>;

<Image
  source={{ uri: 'logo.png', width: 16, height: 16 }}
  aria-hidden={true}
  accessible={true}
  importantForAccessibility="yes"
  aria-labelledby={labelledBy}
  accessibilityLabelledBy="fallback"
/>;
