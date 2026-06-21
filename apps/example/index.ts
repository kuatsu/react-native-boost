// Must be the first import: bakes the benchmark `core` profile's RN feature-flag overrides in before
// react-native's Text module evaluates (no-op outside the benchmark). See the module's @remarks.
import './src/benchmark/feature-flags';

import { registerRootComponent } from 'expo';

import App from './src/app';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
