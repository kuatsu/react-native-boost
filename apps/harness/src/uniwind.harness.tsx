import './global.css';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { describe, it } from 'react-native-harness';
import { expectOptimizedMount, pixel, type Tree } from './support';

const lines = 2;
const size = 'large';
const boxClassName = 'h-12 w-12 rounded-lg bg-blue-500';

const cases: Record<string, Tree> = {
  'Text': (
    <View>
      <Text testID="target" className="text-base font-bold text-red-500">
        Hello
      </Text>
    </View>
  ),
  'Text with dynamic props': (
    <View>
      <Text
        testID="target"
        numberOfLines={lines}
        className="line-clamp-2 text-blue-700"
        selectionColorClassName="accent-orange-500">
        Hello
      </Text>
    </View>
  ),
  'View': (
    <View>
      <View testID="target" className="h-12 w-12 rounded-lg bg-blue-500" />
    </View>
  ),
  'View with dynamic props': (
    <View>
      <View testID="target" className={boxClassName} style={{ opacity: 0.5 }} />
    </View>
  ),
  'Image': (
    <View>
      <Image
        testID="target"
        source={{ uri: pixel }}
        className="h-6 w-6 object-contain"
        tintColorClassName="accent-blue-500"
      />
    </View>
  ),
  'ActivityIndicator': (
    <View>
      <ActivityIndicator testID="target" className="p-2" colorClassName="accent-red-500" />
    </View>
  ),
  'ActivityIndicator with dynamic props': (
    <View>
      <ActivityIndicator
        testID="target"
        size={size}
        animating={false}
        hidesWhenStopped={false}
        className="p-2"
        colorClassName="accent-red-500"
      />
    </View>
  ),
};

describe('components with Uniwind classes optimized by Boost', () => {
  for (const [name, tree] of Object.entries(cases)) {
    it(`mounts ${name}`, () => expectOptimizedMount(tree));
  }
});
