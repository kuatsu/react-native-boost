import { Platform } from 'react-native';

const platform = Platform.OS;
const cacheKey = `${Platform.OS}-cache`;
const isIOS = 'ios' === Platform.OS;
const isAndroid = Platform.OS !== 'ios';
