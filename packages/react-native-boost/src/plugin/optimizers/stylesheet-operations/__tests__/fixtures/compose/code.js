import { StyleSheet } from 'react-native';

export function composeWithNull(style) {
  return StyleSheet.compose(null, style);
}

export function composeStatic() {
  return StyleSheet.compose({ color: 'red' }, { opacity: 1 });
}
