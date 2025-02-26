---
sidebar_position: 2
---

# How it works

Several standard components in React Native such as `Text` and `View` are actually JavaScript-based wrappers around their native counterparts, `TextNativeComponent` and `ViewNativeComponent`. These wrappers are responsible for handling edge cases such as Views nested inside Text components, pressable Text components, and more. These edge cases often only make up an incredibly small fraction of the usage of those components in your app, but require quite a lot of runtime overhead to handle.

React Native Boost statically analyzes the Abstract Syntax Tree (AST) of your code using a Babel plugin to find usages of those components that can safely be replaced with the native components. However, if it finds any components that do require the JS-based wrappers, it will keep them in place, ensuring that your app's behavior is not affected.

## Technical Implementation

### Static Analysis Process

The plugin works by analyzing your app's code during the Babel compilation phase. For each `Text` and `View` component it encounters, it performs a series of checks to determine if the component can be safely optimized. Some examples of the checks that React Native Boost performs before optimizing a component are:

- **Import Validation**: Ensures the component is imported from the `react-native` package
- **Property Analysis**: Checks if the component uses any properties that require the JS wrapper
- **Context Analysis**: Examines the component hierarchy to ensure the native component can be used in the given context
- **Children Analysis**: Examines the component's children, ensuring they can be passed to the native component

Only when all these conditions (and some more) are met will the plugin replace the component with its native counterpart.

### Component Transformations

When the plugin has determined that a component can be optimized, it will replace it with the native component re-exported from the `react-native-boost/runtime` package. The reason for not importing directly from `react-native` is that the native components are not available on non-native platforms like Web, and the runtime package can account for that using React Native's `Platform` API.

### Performance Benefits

By bypassing the JavaScript wrapper components, React Native Boost eliminates bloat like hooks, prop processing, context, and more. Additionally, it flattens the component tree by one level per component optimized. All of this leads to faster initial render times, especially on screens with many Text and View components.

To give you an example, [here](https://github.com/facebook/react-native/blob/main/packages/react-native/Libraries/Text/Text.js) you can see what React Native's `Text` component looks like. You can see that it has a lot of work before it renders the underlying native component – React Native Boost will often let you skip all of that.
