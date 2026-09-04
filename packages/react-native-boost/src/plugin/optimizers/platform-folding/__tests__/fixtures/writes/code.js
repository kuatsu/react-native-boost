import { Platform } from 'react-native';

Platform.OS = 'android';
Platform.OS++;
delete Platform.OS;
for (Platform.OS of platforms) {
}
({ platform: Platform.OS } = source);
