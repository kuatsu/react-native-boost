# 🚀 react-native-boost

![npm bundle size](https://img.shields.io/bundlephobia/min/react-native-boost?style=flat-square) ![GitHub](https://img.shields.io/github/license/kuatsu/react-native-boost?style=flat-square) ![GitHub last commit](https://img.shields.io/github/last-commit/kuatsu/react-native-boost?style=flat-square)

A powerful Babel plugin that automatically optimizes React Native apps by intelligently replacing standard components with their native counterparts. Through clever source code analysis, it identifies safe optimization opportunities, leading to significant performance improvements.

> [!WARNING]
> This project is highly experimental and under active development. **Your app might break** and the optimization strategies used might change significantly between versions. Use with caution!

- ⚡ Automatic performance optimization through source code analysis
- 🔄 Direct & safe mapping of React Native components to native equivalents
- 🎯 Zero runtime overhead - all optimizations happen during build time
- 📱 Compatible with both iOS and Android
- 🧪 Works seamlessly with Expo
- 🎨 Configurable optimization strategies

## Installation

```sh
npm install --save-dev react-native-boost
```

Then, add the plugin to your Babel configuration (`babel.config.js`):

```js
module.exports = {
  plugins: ['module:react-native-boost'],
};
```

## Quick Start

The plugin works automatically once installed. Here's an example of how it optimizes your code:

```jsx
// Your original code
import React from 'react';
import { View, Text } from 'react-native';

const MyComponent = () => (
  <View>
    <Text>Hello, World!</Text>
  </View>
);

// Automatically transformed to
import React from 'react';
import { View } from 'react-native';
import { NativeText } from 'react-native/Libraries/Components/Text/NativeText';

const MyComponent = () => (
  <View>
    <NativeText>Hello, World!</NativeText>
  </View>
);
```

## How It Works

react-native-boost analyzes your code during the build process and:

- Identifies React Native components with optimization opportunities
- Verifies that the usage of the component meets the criteria for optimization
- Transforms the imports and component usage to their native, more performant equivalents

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT
