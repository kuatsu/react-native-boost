/* eslint-disable @typescript-eslint/no-require-imports,unicorn/prefer-module */

// Must be the first import: bakes the benchmark `core` profile's RN feature-flag overrides in before
// react-native's Text module evaluates (no-op outside the benchmark). See the module's @remarks.
import './src/benchmark/feature-flags';
if (process.env.EXPO_PUBLIC_UNIWIND_PARITY !== '1') require('./src/unistyles');

import { registerRootComponent } from 'expo';

const App =
  process.env.EXPO_PUBLIC_UNIWIND_PARITY === '1'
    ? require('./src/screens/uniwind-parity').default
    : require('./src/app').default;

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
