import { Animated, View as _AnimatedWrapperRemovalView } from 'react-native';
import Parent from './parent';
<Parent>
  {/* @boost-force */}
  <_AnimatedWrapperRemovalView
    style={[
      {
        opacity: 1,
      },
    ]}
    collapsable={false}
  />
</Parent>;
