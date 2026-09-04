import * as ReactNative from 'react-native';

const component = ReactNative.Platform.OS !== 'android' ? <IOS /> : <Android />;
