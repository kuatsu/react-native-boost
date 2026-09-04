import { StyleSheet } from 'react-native';
function makeStyle() {
  return (
    StyleSheet.flatten,
    {
      padding: 8,
      color: 'blue',
      transform: [
        {
          scale: 2,
        },
      ],
      opacity: 0.5,
    }
  );
}
