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

## Known Limitations

Due to how Nativewind transforms code within the build pipeline, there are a few class names that are not supported for `Text` components optimized by React Native Boost.

### `select-*`

`select-*` class names are mapped to the `userSelect` style property by Nativewind. The native `Text` component does not support this property and internally rewrites it to the `selectable` prop instead. React Native Boost usually does this for you, but can't do so when using Nativewind class names.

#### Solution

You can either directly use the `selectable` prop, or use the `userSelect` style property instead of the `select-*` class name:

```jsx
// ❌ WRONG
<Text className="select-auto">Hello world</Text>

// ✅ CORRECT
<Text selectable>Hello world</Text>
// or
<Text style={{ userSelect: 'auto' }}>Hello world</Text> // React Native Boost will automatically transform this to the `selectable` prop in order to be compatible with the native `Text` component
```

When directly using the `selectable` prop, you can use the `userSelectToSelectableMap` from the [runtime library](../runtime-library/index.md) to map `userSelect` values to it.

### `align-*`

`align-*` class names are mapped to the `verticalAlign` style property by Nativewind. The native `Text` component does not support this property and internally rewrites it to the `textAlignVertical` style property instead. React Native Boost usually does this for you, but can't do so when using Nativewind class names.

#### Solution

You have to pass it in the `style` prop, there is no alternative. You can either pass it as `verticalAlign` and let React Native Boost transform it to `textAlignVertical`, or pass it as `textAlignVertical` directly.

```jsx
// ❌ WRONG
<Text className="align-center">Hello world</Text>

// ✅ CORRECT
<Text style={{ textAlignVertical: 'center' }}>Hello world</Text>
// or
<Text style={{ verticalAlign: 'middle' }}>Hello world</Text> // React Native Boost will automatically transform this to the `textAlignVertical` style property in order to be compatible with the native `Text` component
```

When directly using the `textAlignVertical` style property, you can use the `verticalAlignToTextAlignVerticalMap` from the [runtime library](../runtime-library/index.md) to map `verticalAlign` values to it.
