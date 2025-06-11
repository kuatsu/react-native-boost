---
sidebar_position: 2
---

# `@boost-ignore` decorator

The `@boost-ignore` decorator is a way to disable optimizations on a line-by-line basis, allowing you to very precisely control which parts of your code are optimized and which are not. The Babel plugin will ignore a component if it's opening tag is preceded by a line containing the `@boost-ignore` decorator.

## Example

```jsx
<Text>This will be optimized.</Text>
{/* @boost-ignore */}
<Text>
  This will not be optimized.
</Text>
```
