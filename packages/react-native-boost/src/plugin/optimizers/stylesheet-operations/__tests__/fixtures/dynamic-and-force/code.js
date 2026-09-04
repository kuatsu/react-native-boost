import { StyleSheet } from 'react-native';

function regularFlatten(styles) {
  return StyleSheet.flatten(styles);
}

function regularCompose(first, second) {
  return StyleSheet.compose(first, second);
}

function forcedFlatten(styles) {
  /* @boost-force */
  return StyleSheet.flatten(styles);
}

function forcedCompose(first, second) {
  /* @boost-force */
  return StyleSheet.compose(first, second);
}
