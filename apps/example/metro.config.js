const { getDefaultConfig } = require('expo/metro-config');
const { withBoostConfig } = require('react-native-boost/metro');

module.exports = withBoostConfig(getDefaultConfig(__dirname), {
  integrations: { unistyles: 'on' },
  ignores: ['node_modules/**', '../../node_modules/**', '**/*.unoptimized.tsx'],
});
