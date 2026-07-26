// Switchable stand-in for `react-native/src/private/featureflags/ReactNativeFeatureFlags` (the real
// module is Flow source the unit pipeline cannot parse). The default — getter absent — emulates
// RN < 0.85; a test emulates RN >= 0.85 by installing a getter (combined with `vi.resetModules()`,
// since the runtime memoizes its first read).

let currentGetter: (() => boolean) | undefined;

export const setDefaultTextToOverflowHidden = (getter: (() => boolean) | undefined): void => {
  currentGetter = getter;
};

export { currentGetter as defaultTextToOverflowHidden };
