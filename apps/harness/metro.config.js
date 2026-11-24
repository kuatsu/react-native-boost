const path = require('node:path');

// Harness requests test files relative to this app, so Metro must not serve from the workspace root.
process.env.EXPO_NO_METRO_WORKSPACE_ROOT = '1';

const { getDefaultConfig } = require('expo/metro-config');
const { withBoostConfig } = require('react-native-boost/metro');

const mode = process.env.HARNESS_MODE ?? 'default';

let config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '../..')];

// Workspace packages resolve their own copies, and Harness runs Metro without Expo's deduplication.
const singletons = ['react', 'react-native'];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isSingleton = singletons.some((name) => moduleName === name || moduleName.startsWith(`${name}/`));
  return context.resolveRequest(
    isSingleton ? { ...context, originModulePath: __filename } : context,
    moduleName,
    platform
  );
};

if (mode === 'uniwind') {
  config = require('uniwind/metro').withUniwindConfig(config, {
    cssEntryFile: './src/global.css',
    dtsFile: './uniwind-types.d.ts',
  });
}

module.exports = withBoostConfig(config, {
  // Boost enables Unistyles mode by itself when the package is installed.
  integrations: { unistyles: mode === 'unistyles' ? 'on' : 'off' },
  target: { reactNative: { packageJson: require.resolve('react-native/package.json') } },
});
