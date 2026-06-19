// React Native source files reference these runtime globals at module-evaluation time. They are
// normally injected by the Metro/RN runtime; define them here so RN's `Text`/`View` modules load
// under vitest's plain `node` environment.
(globalThis as Record<string, unknown>).__DEV__ = false;
(globalThis as Record<string, unknown>).RN$Bridgeless = true;
