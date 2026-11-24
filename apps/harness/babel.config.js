module.exports = function (api) {
  const mode = api.cache.using(() => process.env.HARNESS_MODE ?? 'default');
  if (mode !== 'unistyles') return { presets: ['babel-preset-expo'] };
  return {
    presets: ['babel-preset-expo'],
    overrides: [
      {
        // Boost's runtime must not receive Unistyles wrappers.
        exclude: (filename) => /react-native-boost[/\\]dist[/\\]/.test(filename ?? ''),
        plugins: [['react-native-unistyles/plugin', { root: 'src' }]],
      },
    ],
  };
};
