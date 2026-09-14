import { cloneElement } from 'react';
import { Animated, View, TouchableWithoutFeedback } from 'react-native';
import Parent from './parent';

function FadeIn({ children }) {
  return cloneElement(children, { style: { opacity } });
}

<View>
  <FadeIn>
    <Animated.View />
  </FadeIn>
  <FadeIn>
    <Animated.Text>label</Animated.Text>
  </FadeIn>
  <FadeIn>
    <Animated.Image source={{ uri: 'logo.png' }} />
  </FadeIn>
  <FadeIn>
    <Animated.ScrollView />
  </FadeIn>
  <Parent asChild>
    <Animated.View />
  </Parent>
  <Parent render={<Animated.View />} />
  <Parent render={() => <Animated.View />} />
  <TouchableWithoutFeedback>
    <Animated.View />
  </TouchableWithoutFeedback>
  {cloneElement(<Animated.View />, { style: { opacity } })}
</View>;

const element = <Animated.View />;
const elements = [<Animated.View />];
const render = () => <Animated.View />;
function Component() {
  return <Animated.View />;
}
