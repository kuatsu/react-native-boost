import { StyleSheet as RNStyleSheet } from 'react-native';
import { StyleSheet } from 'other-library';

const optimized = RNStyleSheet.flatten([{ opacity: 1 }]);
const untouched = StyleSheet.flatten([{ opacity: 1 }]);
