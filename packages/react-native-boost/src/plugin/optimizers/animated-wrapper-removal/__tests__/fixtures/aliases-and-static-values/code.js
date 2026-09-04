import { Animated as Motion } from 'react-native';

function onLayout() {}

<Motion.View accessibilityState={{ disabled: false }} onLayout={onLayout}>
  <Child />
</Motion.View>;
