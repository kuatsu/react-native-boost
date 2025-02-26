import { NativeText as _NativeText } from 'react-native-boost/runtime';
import { Text } from 'react-native';
export default function TextBenchmark(props) {
  const optimizedViews = Array.from(
    {
      length: props.count,
    },
    (_, index) => <_NativeText key={index}>Nice text</_NativeText>
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
  if (props.status === 'pending') return <_NativeText>Pending...</_NativeText>;
  return (
    <View>
      {optimizedViews}
      {unoptimizedViews}
    </View>
  );
}
