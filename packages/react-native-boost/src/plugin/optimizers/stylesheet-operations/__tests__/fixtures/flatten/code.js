import { StyleSheet } from 'react-native';

function makeStyle() {
  return StyleSheet.flatten([
    { padding: 8, color: 'red', transform: [{ scale: 2 }] },
    null,
    false,
    [{ color: 'blue' }, { opacity: 0.5 }],
  ]);
}
