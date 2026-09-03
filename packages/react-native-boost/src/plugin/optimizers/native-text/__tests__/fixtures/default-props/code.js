import { Text } from 'react-native';

<Text>Hello</Text>;
<Text allowFontScaling={false}>No Scaling</Text>;
const partialProps = { color: 'blue', ellipsizeMode: 'clip' };
<Text {...partialProps}>Partial props</Text>;
