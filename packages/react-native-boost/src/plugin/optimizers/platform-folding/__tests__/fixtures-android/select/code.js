import { Platform } from 'react-native';

const selected = Platform.select({
  default: 'default',
  native: 'native',
  android: 'android',
});
const fallback = Platform.select({ default: 'default', native: 'native' });
const branch = Platform.OS !== 'android' ? 'other' : 'android';
