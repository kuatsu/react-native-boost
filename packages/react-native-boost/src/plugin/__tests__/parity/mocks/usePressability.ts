// `Text.js` calls `usePressability` to derive event handlers. We don't compare press handlers (they
// are stripped by `normalize`), so a no-op hook returning no handlers is sufficient.
export default function usePressability() {
  return {};
}
