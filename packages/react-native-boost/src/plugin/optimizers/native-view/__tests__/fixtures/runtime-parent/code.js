import { View } from 'react-native';

const Box = ({ children }) => <View testID="box">{children}</View>;
const ExplicitChildren = ({ children }) => <View children={children} />;
const Empty = () => <View />;
const Nested = ({ children }) => (
  <View>
    <View>{children}</View>
  </View>
);

function renderBox(children) {
  return <View>{children}</View>;
}
