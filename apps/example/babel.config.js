module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'react-native-boost/plugin',
        {
          integrations: { unistyles: 'on' },
          ignores: ['node_modules/**', '../../node_modules/**', '**/*.unoptimized.tsx'],
        },
      ],
      [
        'react-native-unistyles/plugin',
        {
          root: 'src',
        },
      ],
    ],
  };
};
