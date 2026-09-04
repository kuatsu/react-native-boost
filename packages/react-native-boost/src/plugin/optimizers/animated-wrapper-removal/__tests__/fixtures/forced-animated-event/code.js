import { Animated } from 'react-native';

<>
  {/* @boost-force */}
  <Animated.ScrollView onScroll={Animated.event([], { useNativeDriver: true })} />
</>;
