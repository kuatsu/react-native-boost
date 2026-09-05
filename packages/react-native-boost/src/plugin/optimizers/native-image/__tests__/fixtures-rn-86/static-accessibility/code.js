import { Image } from 'react-native';

<Image
  src="logo.png"
  alt="Fallback"
  aria-label="Winner"
  aria-hidden={true}
  accessibilityState={{ disabled: false }}
  aria-disabled={true}
/>;
<Image src="logo.png" alt={null} accessible={false} aria-busy={null} accessibilityState={undefined} />;
<Image src="logo.png" alt="Fallback" aria-label={label} aria-busy={true} />;
