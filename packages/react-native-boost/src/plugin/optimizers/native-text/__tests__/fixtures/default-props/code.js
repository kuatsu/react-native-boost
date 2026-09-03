import { Text } from 'react-native';

const someFunction = () => ({});

<Text>Hello</Text>;
<Text allowFontScaling={false}>No Scaling</Text>;
const unknownProps = someFunction();
<Text {...unknownProps}>Unknown</Text>;
const partialProps = { color: 'blue', ellipsizeMode: 'clip' };
<Text {...partialProps}>Partial props</Text>;
