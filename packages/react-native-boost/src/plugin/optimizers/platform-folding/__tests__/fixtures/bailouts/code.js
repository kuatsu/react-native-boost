import { Platform } from 'react-native';
import { Platform as OtherPlatform } from 'other-library';

const computed = Platform.select({ [key]: 'computed', ios: 'ios' });
const spread = Platform.select({ ...spec, ios: 'ios' });
const getter = Platform.select({
  get ios() {
    return 'getter';
  },
});
const setter = Platform.select({ set ios(value) {}, default: 'default' });
const method = Platform.select({
  ios() {
    return 'method';
  },
});
const prototype = Platform.select({ __proto__: null, ios: 'ios' });
const extraArgument = Platform.select({ ios: 'ios' }, sideEffect());
const loose = Platform.OS == 'ios' ? 'yes' : 'no';
const dynamic = Platform.OS === target ? 'yes' : 'no';
const version = Platform.Version === 'ios' ? 'yes' : 'no';
const constants = Platform.constants === 'ios' ? 'yes' : 'no';
const otherSelected = OtherPlatform.select({ ios: 'ios' });
const otherBranch = OtherPlatform.OS === 'ios' ? 'yes' : 'no';
