import { Animated as NativeAnimated, Text, View, Pressable } from 'react-native';
import * as Native from 'react-native';
import Reanimated, { createAnimatedComponent as animate } from 'react-native-reanimated';
import * as Motion from 'react-native-reanimated';

const AnimatedPressable = animate(Pressable);
const AnimatedView = Reanimated.View;
const Custom = Reanimated.createAnimatedComponent(Unknown);

<Text>
  <NativeAnimated.View style={dynamicStyle}>
    <Text>native animated</Text>
  </NativeAnimated.View>
  <Native.Animated.View style={dynamicStyle}>
    <Text>namespace native animated</Text>
  </Native.Animated.View>
  <Reanimated.View entering={animation}>
    <View>
      <Text>reanimated</Text>
    </View>
  </Reanimated.View>
  <Motion.default.View>
    <Text>namespace reanimated</Text>
  </Motion.default.View>
  <AnimatedPressable>
    <Text>factory</Text>
  </AnimatedPressable>
  <AnimatedView>
    <Text>alias</Text>
  </AnimatedView>
  <Reanimated.ScrollView>
    <Text>scroll stays unknown</Text>
  </Reanimated.ScrollView>
</Text>;

<View>
  <Reanimated.Text>
    <Text>inline</Text>
  </Reanimated.Text>
  <NativeAnimated.Text style={dynamicStyle}>
    <Text>inline native</Text>
  </NativeAnimated.Text>
  <Custom>
    <Text>unknown</Text>
  </Custom>
  <Motion.View>
    <Text>not a default export member</Text>
  </Motion.View>
</View>;
