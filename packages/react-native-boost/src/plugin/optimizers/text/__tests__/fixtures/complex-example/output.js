import {
  getDefaultTextStyle as _getDefaultTextStyle,
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
} from 'react-native-boost/runtime';
import { Text } from 'react-native';
export default function TextBenchmark(props) {
  const optimizedViews = Array.from(
    {
      length: props.count,
    },
    (_, index) => (
      <_NativeText
        style={_getDefaultTextStyle()}
        key={index}
        allowFontScaling={true}
        ellipsizeMode={'tail'}
        accessible={_getDefaultTextAccessible()}>
        Nice text
      </_NativeText>
    )
  );
  const unoptimizedViews = Array.from(
    {
      length: props.count,
    },
    (_, index) => (
      // @boost-ignore
      <Text key={index}>Nice text</Text>
    )
  );
  if (props.status === 'pending')
    return (
      <_NativeText
        style={_getDefaultTextStyle()}
        allowFontScaling={true}
        ellipsizeMode={'tail'}
        accessible={_getDefaultTextAccessible()}>
        Pending...
      </_NativeText>
    );
  return (
    <View>
      {optimizedViews}
      {unoptimizedViews}
    </View>
  );
}
