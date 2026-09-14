import { Fragment, memo } from 'react';
import { Animated, Text, View } from 'react-native';

const Box = memo(({ children }) => <View>{children}</View>);
const Pass = ({ children }) => children;

<View>
  <Animated.View />
  <>
    <Animated.Image source={{ uri: 'logo.png' }} />
  </>
  <Fragment>
    <Animated.ScrollView />
  </Fragment>
  <Box>
    <Animated.Text>label</Animated.Text>
  </Box>
  <Pass>
    <Animated.View />
  </Pass>
  <Text>
    <Animated.Text>nested</Animated.Text>
  </Text>
</View>;
