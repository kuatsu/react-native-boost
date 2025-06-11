---
sidebar_position: 1
---

# Configure the Babel plugin

The Babel plugin, imported via `react-native-boost/plugin`, is the heart of the library. It's responsible for analyzing your code and applying optimizations to it.

While the plugin is configured to be used out of the box, you can configure it to your needs. This may be necessary if you want to disable optimizations for a specific file, or even disable individual optimizers completely.

## Example configuration

```js
// babel.config.js
module.exports = {
  plugins: [
    [
      'react-native-boost/plugin',
      {
        verbose: true,
        ignores: ['node_modules/**'],
        optimizations: {
          text: true,
          view: false,
        },
      },
    ],
  ],
};
```

## Configuration options

### `verbose`

Enables verbose logging of performed optimizations, including the filename and line number of the component that was optimized. Defaults to `false`.

### `ignores`

An array of glob patterns to ignore when performing optimizations. Defaults to an empty array (no files are ignored).

:::info

By default, the plugin does not ignore any files. This means that the plugin will also recursively scan your `node_modules` directory and optimize code in there as well. If you only want to optimize code in your own project, you should add the glob pattern `node_modules/**` to the `ignores` array.

:::

### `optimizations`

An object specifying which optimizers to enable or disable. The keys are the names of the optimizers, and the values are booleans indicating whether to enable or disable them. By default, all optimizers are enabled. The following optimizers are available:

- `text`
- `view`

## Enable only in development / production mode

Babel supports overriding / merging the configuration based on the environment. See the Babel documentation [here](https://babeljs.io/docs/options#env) and [here](https://babeljs.io/docs/options#envname).

For example, to only enable React Native Boost in development mode, you can do the following:

```js
module.exports = {
  // your existing configuration...
  env: {
    development: {
      plugins: ['react-native-boost/plugin'],
    },
  },
};
```
