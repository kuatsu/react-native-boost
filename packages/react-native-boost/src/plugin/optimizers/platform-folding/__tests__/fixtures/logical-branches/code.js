import { Platform } from 'react-native';

const accessory = Platform.OS === 'ios' && <Accessory />;
const androidAccessory = Platform.OS === 'android' && missing();
const fallback = Platform.OS === 'ios' || missing();
const androidFallback = Platform.OS === 'android' || <Fallback />;
