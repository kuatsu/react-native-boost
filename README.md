# 🚀 react-native-boost

![npm bundle size](https://img.shields.io/bundlephobia/min/react-native-boost?style=flat-square) ![GitHub](https://img.shields.io/github/license/kuatsu/react-native-boost?style=flat-square) ![GitHub last commit](https://img.shields.io/github/last-commit/kuatsu/react-native-boost?style=flat-square)

A powerful Babel plugin that automatically optimizes React Native apps through static source code analysis. It replaces standard React Native components with their native counterparts where possible, leading to significant performance improvements.

- ⚡ Automatic performance optimization through source code analysis
- 🔒 Safe optimizations that don't break your app
- 🎯 Virtually zero runtime overhead
- 📱 Cross-platform compatible
- 🧪 Works seamlessly with Expo
- 🎨 Configurable optimization strategies

## Documentation

The documentation is available at [react-native-boost.oss.kuatsu.de](https://react-native-boost.oss.kuatsu.de).

## Benchmark

The app in the `apps/example` directory serves as a benchmark for the performance of the plugin.

<div align="center">
  <img src="./apps/docs/content/docs/information/img/benchmark-ios.png" width="500" />
</div>

More benchmarks are available in the [docs](https://react-native-boost.oss.kuatsu.de/docs/information/benchmarks).

## Compatibility

| `react-native-boost` | React Native     |
| -------------------- | ---------------- |
| `0.x`                | All versions[^1] |
| `1.x`                | `>=0.83`         |

[^1]: Starting from React Native `0.80`, `react-native-boost@0` prints import deprecation warnings.

## Installation

Install the package using your favorite package manager. Please **do not** install the package as a dev dependency. While the Babel plugin itself would work as a dev dependency, it relies on importing the runtime library (`react-native-boost/runtime`) into your code, which requires the package to be installed as a regular dependency. Read more [here](https://react-native-boost.oss.kuatsu.de/docs/runtime-library/).

```sh
npm install react-native-boost
# or
yarn add react-native-boost
```

Then, add the plugin to your Babel configuration (`babel.config.js`):

```js
module.exports = {
  plugins: ['react-native-boost/plugin'],
};
```

If you're using Expo and don't see the `babel.config.js` file, run the following command to create it:

```sh
npx expo customize babel.config.js
```

Finally, restart your React Native development server and clear the bundler cache:

```sh
npm start --clear
# or
yarn start --clear
```

That's it! No imports in your code, rebuilding, or anything else is required.

Optionally, you can configure the Babel plugin with a few options described in the [documentation](https://react-native-boost.oss.kuatsu.de/docs/configuration/configure).

## How it works

A technical rundown of how the plugin works can be found in the [docs](https://react-native-boost.oss.kuatsu.de/docs/information/how-it-works).

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT
