import { Animated, ScrollView as _AnimatedWrapperRemovalScrollView } from 'react-native';
<>
  {/* @boost-force */}
  <_AnimatedWrapperRemovalScrollView
    onScroll={Animated.event([], {
      useNativeDriver: true,
    })}
    scrollEventThrottle={0.0001}
    collapsable={false}
  />
</>;
