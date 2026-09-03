import { View } from 'react-native';
function Component(props) {
  return (
    <>
      <View {...props} aria-label="x" />
      {/* @boost-force */}
      <View {...props} aria-label="x" />
    </>
  );
}
