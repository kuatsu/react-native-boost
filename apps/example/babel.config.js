/**
 * Babel configuration function that configures presets and plugins for the React Native Boost example application.
 * @param {object} api - The Babel API object.
 * @returns {object} The Babel configuration object.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['react-native-boost/plugin', { ignores: ['node_modules/**', '../../node_modules/**', '**/*.unoptimized.tsx'] }],
    ],
  };
};
