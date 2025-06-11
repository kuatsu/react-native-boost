---
sidebar_position: 2
---

# Nativewind Support

If your app uses Nativewind, you'll need to configure it to correctly transform the `className` props of the components optimized by React Native Boost. You can do this by using Nativewind's [`cssInterop` helper function](https://www.nativewind.dev/docs/api/css-interop) (available in Nativewind v4) on the `NativeText` and `NativeView` components exposed by the [runtime library](../runtime-library/index.md).

## Example

```jsx
import { cssInterop } from 'nativewind';
import { NativeText, NativeView } from 'react-native-boost/runtime';

cssInterop(NativeText, { className: 'style' });
cssInterop(NativeView, { className: 'style' });
```

This matches Nativewind's own implementation of the standard `Text` and `View` components. See [here](https://github.com/nativewind/nativewind/blob/eecaf822da6f4014e4f6232e97bc0cec2ec0ffa0/packages/react-native-css-interop/src/runtime/components.ts#L29).

:::warning

Due to how Nativewind works and how the `Text` component is optimized to its native equivalent, there are a few styling edge cases that are not supported for optimized `Text` components:

- `select-*` class names are not supported (used to control whether text is selectable or not).
- `align-*` class names are not supported (used for vertical alignment).

If you need to use these styling properties, either disable optimization of the specific component using [`@boost-ignore`](./boost-decorator.md), or use the standard `style` prop for these style attributes instead of Nativewind's `className`.

:::
