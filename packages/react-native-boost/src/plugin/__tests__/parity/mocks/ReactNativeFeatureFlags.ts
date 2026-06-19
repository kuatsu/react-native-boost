// `Text.js` gates its implementation on this JS feature flag (native default: false), which selects
// the legacy code path whose `Platform.select` `accessible` logic we compare against. If a future
// RN `Text.js` consults another flag, the import fails loud at module load — add it here.
export const reduceDefaultPropsInText = () => false;
