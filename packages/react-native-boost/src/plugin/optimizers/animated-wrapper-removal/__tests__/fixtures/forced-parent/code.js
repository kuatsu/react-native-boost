import { Animated } from 'react-native';
import Parent from './parent';

<Parent>
  {/* @boost-force */}
  <Animated.View style={[{ opacity: 1 }]} />
</Parent>;
