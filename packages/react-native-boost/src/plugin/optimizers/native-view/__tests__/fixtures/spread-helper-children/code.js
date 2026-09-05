import { Text, View } from 'react-native';

function getProps(children) {
  return { children };
}

export const Cell = () => (
  <Text>
    <View {...getProps(<Text>cell</Text>)} />
  </Text>
);
