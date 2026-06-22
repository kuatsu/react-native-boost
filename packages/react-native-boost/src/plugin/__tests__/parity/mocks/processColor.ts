// Stand-in for `react-native/Libraries/StyleSheet/processColor`. The real implementation does a CJS
// `require('../Utilities/Platform')` that escapes vite resolution and pulls raw Flow into node, so it must
// be mocked. It maps a named color to a packed int so the `selectionColor` parity case proves both sides
// actually *call* processColor: a passthrough stub would let a raw forward (Boost forgetting the call, or
// dropping the prop) go undetected.
//
// Both sides resolve to this one function so the expected value is unambiguous: the wrapper via its default
// import (`import processColor from '.../processColor'`, redirected by basename), the Boost side via the
// named re-export in `mocks/react-native.ts` (which backs the runtime index's `import { processColor }`).
export function processColor(color: unknown): unknown {
  return color === 'red' ? 0xffff0000 : color;
}

export default processColor;
