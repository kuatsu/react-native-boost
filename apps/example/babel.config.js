module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [['react-native-boost/plugin', { verbose: true, ignores: ['node_modules/**'] }]],
  };
};
