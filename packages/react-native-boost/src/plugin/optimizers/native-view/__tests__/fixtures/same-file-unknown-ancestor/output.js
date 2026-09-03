import { View } from 'react-native';
const Wrapper = ({ children }) => <UnknownContainer>{children}</UnknownContainer>;
<Wrapper>
  <View>
    <NotOptimized />
  </View>
</Wrapper>;
