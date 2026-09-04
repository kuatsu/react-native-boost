import { Platform } from 'react-native';
if (Platform.OS === 'ios') {
  installIOS();
} else {
  var installer = require('./install-android');
}
use(installer);
