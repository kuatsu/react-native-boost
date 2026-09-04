import { Animated } from 'react-native';
<Animated.ScrollView
  onScroll={Animated.event([], {
    useNativeDriver: true,
  })}
/>;
