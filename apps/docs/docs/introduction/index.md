---
sidebar_position: 1
title: Introduction
---

# React Native Boost

**React Native Boost** is a powerful library that can improve your React Native app's performance by up to 50%. It consists of two parts:

- A Babel plugin that performs static analysis on your code and applies micro-optimizations throughout your codebase.
- A runtime library that is used by the Babel plugin to apply optimizations that can only be applied at runtime.

The code analyzer is built to be very strict when it comes to where it applies optimizations. It will try to only apply optimizations that are guaranteed to not affect the app's behavior. If something breaks anyway, you're able to disable specific optimizations on a file-by-file or even line-by-line basis, ensuring the plugin can be adapted to your needs.

:::warning

The library and its Babel plugin are still experimental. You should expect things to break. Please report any issues you encounter to the [GitHub repository](https://github.com/kuatsu/react-native-boost/issues) with reproducible examples, and use the library's ignore mechanisms to disable optimizations for problematic files or lines of code.

:::

## Getting Started

Installation and setup is an incredibly simple process:

1. Install the library and its dependencies using your favorite package manager:

```bash
npm install react-native-boost
# or
yarn add react-native-boost
```

2. Add the Babel plugin to your project:

```js
// babel.config.js
module.exports = {
  plugins: ['react-native-boost/plugin'],
};
```

3. Restart your React Native development server and clear the bundler cache:

```bash
npm start --clear
# or
yarn start --clear
```

That's it! You do not need to import React Native Boost into your code, install native dependencies, or do anything else. The plugin will now ✨ automagically ✨ optimize your code.
