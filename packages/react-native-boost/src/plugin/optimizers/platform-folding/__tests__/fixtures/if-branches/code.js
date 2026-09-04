import { Platform } from 'react-native';

if (Platform.OS === 'ios') {
  require('./install-ios');
} else {
  require('./install-android');
}
if (Platform.OS !== 'ios') require('./not-ios');
