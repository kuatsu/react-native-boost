import { View } from 'react-native';

function getLabel() {
  return { 'aria-label': 'label' };
}
function getUnknown(input) {
  return input;
}
function getProps() {
  recordCall();
  return { testID: 'cell' };
}

export function Screen({ input }) {
  return (
    <View>
      <View {...getLabel()} />
      <View {...getUnknown(input)} />
      <View aria-hidden={false} {...getProps()} />
      <Inspect>
        <View {...getProps()} />
      </Inspect>
    </View>
  );
}
