import { View } from 'react-native';
const nested = {
  ...more,
};
const computed = {
  [property]: 'label',
};
let reassigned = {};
reassigned = {
  'aria-label': 'label',
};
const mutated = {};
mutated['aria-label'] = 'label';
const getter = {
  get title() {
    return 'label';
  },
};
<View {...nested} />;
<View {...computed} />;
<View {...reassigned} />;
<View {...mutated} />;
<View {...getter} />;
<View aria-label={first()} testID={second()} />;
<View id="fixed" nativeID={second()} />;
const Box = ({ children }) => (
  <View aria-label={first()} testID={second()}>
    {children}
  </View>
);
