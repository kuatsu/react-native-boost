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
import { flattenTextStyle } from 'react-native-boost/runtime';

const style = {
  fontWeight: 500,
  userSelect: 'auto',
  color: 'blue',
};

const processedStyle = flattenTextStyle(style);

console.log(processedStyle);
```
