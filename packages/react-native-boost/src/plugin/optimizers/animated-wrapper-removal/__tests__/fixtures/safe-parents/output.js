import {
  View as _AnimatedWrapperRemovalView,
  Image as _AnimatedWrapperRemovalImage,
  ScrollView as _AnimatedWrapperRemovalScrollView,
  Text as _AnimatedWrapperRemovalText,
} from 'react-native';
import { Fragment, memo } from 'react';
import { Animated, Text, View } from 'react-native';
const Box = memo(({ children }) => <View>{children}</View>);
const Pass = ({ children }) => children;
<View>
  <_AnimatedWrapperRemovalView collapsable={false} style={undefined} />
  <>
    <_AnimatedWrapperRemovalImage
      source={{
        uri: 'logo.png',
      }}
      collapsable={false}
      style={undefined}
    />
  </>
  <Fragment>
    <_AnimatedWrapperRemovalScrollView scrollEventThrottle={0.0001} collapsable={false} style={undefined} />
  </Fragment>
  <Box>
    <_AnimatedWrapperRemovalText collapsable={false} style={undefined}>
      label
    </_AnimatedWrapperRemovalText>
  </Box>
  <Pass>
    <_AnimatedWrapperRemovalView collapsable={false} style={undefined} />
  </Pass>
  <Text>
    <_AnimatedWrapperRemovalText collapsable={false} style={undefined}>
      nested
    </_AnimatedWrapperRemovalText>
  </Text>
</View>;
