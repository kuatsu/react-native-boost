import { Platform as RNPlatform } from 'react-native';

const selected = RNPlatform.select({
  default: 'default',
  native: 'native',
  ios: 'ios',
});
const fallback = RNPlatform.select({ default: 'default', native: 'native' });
const defaultOnly = RNPlatform.select({ default: 'default' });
const branch = RNPlatform.OS === 'ios' ? 'yes' : 'no';
