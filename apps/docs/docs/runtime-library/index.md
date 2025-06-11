---
sidebar_position: 3
---

# Runtime Library

The runtime library, imported via `react-native-boost/runtime`, is a small library that is used by the Babel plugin to actually apply optimizations in your app. Other than re-exporting the native Text and View components (in order to avoid issues with `react-native-web`), the runtime library also exports a few helper functions that can be used by the Babel plugin. While you can import the runtime library directly, we do not recommend doing so in most cases. The exported functions and components are intended to be used directly by the Babel plugin and can change without prior notice. You may need to import from the runtime library in some cases, such as when [configuring Nativewind support](../configuration/nativewind.md). However, be aware of potential breaking changes when importing the runtime into your project yourself.

## `processTextStyle`

The `processTextStyle` function is a utility used to flatten and process styles of Text components in order to make them compatible with the optimized native components.

### Parameters

- **style**: `GenericStyleProp<TextStyle>`
  A style object (or an array of style objects) that may be nested, conditional, or falsy (such as `null`, `false`, or an empty string).

### Return Value

Returns an **object** containing:

- A `style` property with the flattened and normalized style, as well as additional properties generated from the styles such as `selectable`.

If a falsy or invalid style is passed, the function returns an empty object.

### Example

```javascript
import { processTextStyle } from 'react-native-boost/runtime';

const style = {
  fontWeight: 500,
  userSelect: 'auto',
  color: 'blue',
};

const props = processTextStyle(style);

console.log(props); // { style: { fontWeight: '500', color: 'blue' }, selectable: true }
```

## `processAccessibilityProps`

The `processAccessibilityProps` function maps accessibility-related props to the props expected by the native components.

### Parameters

- **props**: `Record<string, any>`
  An object containing standard accessibility props and ARIA attributes.

### Return Value

Returns a new **object** with normalized accessibility props supported by the native components.

### Example

```javascript
import { processAccessibilityProps } from 'react-native-boost/runtime';

const props = {
  'aria-busy': true,
  'accessibilityLabel': 'Submit button',
};

const processedProps = processAccessibilityProps(props);

console.log(processedProps); // { 'accessibilityLabel': 'Submit button', 'accessibilityState': { busy: true }, 'accessible': true }
```

## `userSelectToSelectableMap`

The `userSelectToSelectableMap` object maps values for the Text component's `userSelect` style property to the `selectable` prop, which the native Text component uses instead.

## `verticalAlignToTextAlignVerticalMap`

The `verticalAlignToTextAlignVerticalMap` object maps values for the Text component's `verticalAlign` style property to the `textAlignVertical` style property, which the native Text component uses instead.

## `NativeText`

The `NativeText` component imports the native Text component from React Native on native platforms such as iOS and Android, and falls back to the standard Text component on web. This prevents bundling issues for react-native-web projects.

### Example

```javascript
import { NativeText } from 'react-native-boost/runtime';

<NativeText>Hello</NativeText>;
```

## `NativeView`

The `NativeView` component imports the native View component from React Native on native platforms such as iOS and Android, and falls back to the standard View component on web. This prevents bundling issues for react-native-web projects.

### Example

```javascript
import { NativeView, NativeText } from 'react-native-boost/runtime';

<NativeView>
  <NativeText>Hello</NativeText>
</NativeView>;
```
