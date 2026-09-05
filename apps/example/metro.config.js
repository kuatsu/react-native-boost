const { getDefaultConfig } = require('expo/metro-config');
const { withBoostConfig } = require('react-native-boost/metro');

const uniwindParity = process.env.EXPO_PUBLIC_UNIWIND_PARITY === '1';
const config = uniwindParity
  ? require('uniwind/metro').withUniwindConfig(getDefaultConfig(__dirname), {
      cssEntryFile: './src/screens/uniwind-parity/global.css',
      dtsFile: './uniwind-types.d.ts',
    })
  : getDefaultConfig(__dirname);

module.exports = withBoostConfig(config, {
  integrations: { unistyles: uniwindParity ? 'off' : 'on' },
  ignores: ['node_modules/**', '../../node_modules/**', '**/*.unoptimized.tsx'],
});
