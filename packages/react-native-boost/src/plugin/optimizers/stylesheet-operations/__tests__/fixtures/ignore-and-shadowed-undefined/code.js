import { StyleSheet } from 'react-native';

/* @boost-ignore */
const ignored = StyleSheet.flatten([{ color: 'red' }]);

function flatten(undefined) {
  return StyleSheet.flatten([undefined, { opacity: 1 }]);
}
