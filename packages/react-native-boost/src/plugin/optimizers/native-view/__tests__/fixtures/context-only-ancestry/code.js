import React from 'react';
import { Text, View, TouchableWithoutFeedback } from 'react-native';

function Mixed({ children, inline }) {
  if (inline) return <Text>{children}</Text>;
  return children;
}
function Clone({ children }) {
  return React.cloneElement(children, { 'aria-label': 'Name' });
}
function UnsafeBranch({ children, inline }) {
  if (inline) return <Text>{children}</Text>;
  return React.cloneElement(children, { 'aria-label': 'Name' });
}
function Inspect({ children }) {
  return children.type === View ? children : null;
}

<>
  <Text>
    <View aria-label="Name">
      <Text>label</Text>
    </View>
  </Text>
  <Mixed>
    <View>
      <Text>label</Text>
    </View>
  </Mixed>
  <Clone>
    <View>
      <Text>label</Text>
    </View>
  </Clone>
  <UnsafeBranch>
    <View>
      <Text>label</Text>
    </View>
  </UnsafeBranch>
  <Inspect>
    <View>
      <Text>label</Text>
    </View>
  </Inspect>
  <TouchableWithoutFeedback>
    <View>
      <Text>label</Text>
    </View>
  </TouchableWithoutFeedback>
  <Text>
    <View {...unknownProps}>
      <Text>label</Text>
    </View>
  </Text>
  <Text>
    <View />
  </Text>
</>;
