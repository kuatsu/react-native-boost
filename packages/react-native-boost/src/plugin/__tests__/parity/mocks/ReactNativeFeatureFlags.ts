// `Text.js` / `View.js` gate their implementations on these JS feature flags, selecting the code
// paths whose logic the Boost runtime replicates and this suite compares against. If a future RN
// wrapper consults another flag, the render fails loud ("x is not a function") — add it here.
//
// `defaultTextToOverflowHidden` defaults to true on RN 0.85+ (the wrapper then prepends
// `overflow: 'hidden'` to every Text style), which the Boost runtime replicates via
// `getDefaultTextStyle` — both sides of the parity comparison read THIS getter, so the suite
// exercises the real RN 0.86 default. The flag-off state equals RN 0.83/0.84, where the getter does
// not exist; that path is covered by the runtime unit tests (getDefaultTextStyle/processTextStyle).
export const defaultTextToOverflowHidden = () => true;
// Matches the real default on every supported RN version (the flag was removed in 0.87): with it off,
// the native side DISCARDS raw `aria-*`/`id`/`tabIndex` props, so Boost must keep translating them.
export const enableNativeViewPropTransformations = () => false;
