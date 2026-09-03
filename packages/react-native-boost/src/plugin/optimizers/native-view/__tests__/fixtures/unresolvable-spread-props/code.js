import { View } from 'react-native';
function MyComponent(props) {
  return (
    <View {...props}>
      <NotOptimized />
    </View>
  );
}
