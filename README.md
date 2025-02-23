# 🚀 react-native-boost

![npm bundle size](https://img.shields.io/bundlephobia/min/react-native-boost?style=flat-square) ![GitHub](https://img.shields.io/github/license/kuatsu/react-native-boost?style=flat-square) ![GitHub last commit](https://img.shields.io/github/last-commit/kuatsu/react-native-boost?style=flat-square)

A powerful Babel plugin that automatically optimizes React Native apps through source code analysis and optimization. It identifies safe micro-optimization opportunities, which can lead to significant performance improvements.

> [!WARNING]
> This project is highly experimental and under active development. **Your app might break** and the optimization strategies used can change significantly between versions. Use with caution!

- ⚡ Automatic performance optimization through source code analysis
- 🔒 Safe optimizations that don't break your app
- 🎯 Zero runtime overhead - all optimizations happen during build time
- 📱 Cross-platform compatible
- 🧪 Works seamlessly with Expo
- 🎨 Configurable optimization strategies

## Installation

```sh
npm install --save-dev react-native-boost
# or
yarn add --dev react-native-boost
```

Then, add the plugin to your Babel configuration (`babel.config.js`):

```js
module.exports = {
  plugins: ['module:react-native-boost'],
};
```

Optionally, you can configure the plugin to disable specific optimizations:

```js
module.exports = {
  plugins: [
    [
      'react-native-boost/plugin',
      {
        optimizations: {
          text: false,
        },
      },
    ],
  ],
};
```

## How It Works

Several standard components in React Native are actually wrappers around their native counterparts. These wrappers often only handle edge cases and aren't needed in most cases. However, they add additional runtime overhead and depth to the component tree, which can lead to performance bottlenecks.

React Native Boost replaces these wrapper components directly with their respective native components, flattening the component tree. It intelligently analyzes your code and only optimizes components that are used in a way where they can be optimized without breaking the app.

Here's an example of how it works:

```jsx
// Your original code 🐌
import React from 'react';
import { View, Text } from 'react-native';

const MyComponent = () => (
  <View>
    <Text>Hello, World!</Text>
  </View>
);

// Automafically transformed to ✨
import React from 'react';
import { View } from 'react-native';
import { NativeText } from 'react-native/Libraries/Components/Text/NativeText';

const MyComponent = () => (
  <View>
    <NativeText>Hello, World!</NativeText>
  </View>
);
```

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT
