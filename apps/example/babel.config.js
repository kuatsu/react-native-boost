module.exports = function (api) {
  api.cache(true);
  if (process.env.EXPO_PUBLIC_UNIWIND_PARITY === '1') return { presets: ['babel-preset-expo'] };
  return {
    presets: ['babel-preset-expo'],
    overrides: [
      {
        // The runtime and RN-only benchmark must not receive Unistyles wrappers.
        exclude: (filename) => /react-native-boost[/\\]dist[/\\]|view-context-(benchmark|parity)/.test(filename ?? ''),
        plugins: [['react-native-unistyles/plugin', { root: 'src' }]],
      },
    ],
  };
};
