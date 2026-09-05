import {
  textDefaultOverflowStyle as _textDefaultOverflowStyle,
  NativeText as _NativeText,
  NativeView as _NativeView,
} from 'react-native-boost/runtime';
import { Animated as NativeAnimated, Text, View, Pressable } from 'react-native';
import * as Native from 'react-native';
import Reanimated, { createAnimatedComponent as animate } from 'react-native-reanimated';
import * as Motion from 'react-native-reanimated';
const AnimatedPressable = animate(Pressable);
const AnimatedView = Reanimated.View;
const Custom = Reanimated.createAnimatedComponent(Unknown);
<Text>
  <NativeAnimated.View style={dynamicStyle}>
    <_NativeText style={_textDefaultOverflowStyle} allowFontScaling={true} ellipsizeMode={'tail'} accessible={true}>
      native animated
    </_NativeText>
  </NativeAnimated.View>
  <Native.Animated.View style={dynamicStyle}>
    <_NativeText style={_textDefaultOverflowStyle} allowFontScaling={true} ellipsizeMode={'tail'} accessible={true}>
      namespace native animated
    </_NativeText>
  </Native.Animated.View>
  <Reanimated.View entering={animation}>
    <_NativeView>
      <_NativeText style={_textDefaultOverflowStyle} allowFontScaling={true} ellipsizeMode={'tail'} accessible={true}>
        reanimated
      </_NativeText>
    </_NativeView>
  </Reanimated.View>
  <Motion.default.View>
    <_NativeText style={_textDefaultOverflowStyle} allowFontScaling={true} ellipsizeMode={'tail'} accessible={true}>
      namespace reanimated
    </_NativeText>
  </Motion.default.View>
  <AnimatedPressable>
    <_NativeText style={_textDefaultOverflowStyle} allowFontScaling={true} ellipsizeMode={'tail'} accessible={true}>
      factory
    </_NativeText>
  </AnimatedPressable>
  <AnimatedView>
    <_NativeText style={_textDefaultOverflowStyle} allowFontScaling={true} ellipsizeMode={'tail'} accessible={true}>
      alias
    </_NativeText>
  </AnimatedView>
  <Reanimated.ScrollView>
    <Text>scroll stays unknown</Text>
  </Reanimated.ScrollView>
</Text>;
<_NativeView>
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
</_NativeView>;
