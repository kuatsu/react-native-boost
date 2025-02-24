---
sidebar_position: 3
---

# Runtime Library

The runtime library, imported via `react-native-boost`, is a small library that is used by the Babel plugin to apply optimizations that can only be applied at runtime. While you can import the runtime library directly, we do not recommend doing so. The functions exported are mainly basic helper functions directly intended to be used by the Babel plugin and can change without prior notice. For the sake of completeness, we've documented them here, however.

## `flattenTextStyle`

The `flattenTextStyle` function is a utility used to flatten and process `<Text>` styles in React Native projects. It normalizes style properties and maps them to their native counterparts.

### Parameters

- **style**: `GenericStyleProp<TextStyle>`
  A style object (or an array of style objects) that may be nested, conditional, or falsy (such as `null`, `false`, or an empty string).

### Return Value

Returns an **object** containing:

- A `style` property with the flattened and normalized style, as well as properties such as `selectable` and `textAlignVertical` mapped to their native counterparts.

If a falsy or invalid style is passed, the function returns an empty object.

### Example

```javascript
import { flattenTextStyle } from 'react-native-boost';

const style = {
  fontWeight: 500,
  userSelect: 'auto',
  color: 'blue',
};

const processedStyle = flattenTextStyle(style);

console.log(processedStyle);
```

## `normalizeAccessibilityProperties`

The `normalizeAccessibilityProperties` function maps accessibility-related props to the props expected by the native components.

### Parameters

- **props**: `Record<string, any>`
  An object containing standard accessibility props and ARIA attributes.

### Return Value

Returns a new **object** with normalized accessibility properties, so that the props can be used by the native components.

### Example

```javascript
import { normalizeAccessibilityProperties } from 'react-native-boost';

const props = {
  'aria-label': 'Submit button',
  'accessibilityLabel': 'Submit button',
};

const normalizedProps = normalizeAccessibilityProperties(props);

console.log(normalizedProps);
```
