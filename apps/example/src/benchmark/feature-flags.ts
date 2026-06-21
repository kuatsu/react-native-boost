/* eslint-disable @typescript-eslint/no-require-imports,unicorn/prefer-module */

/**
 * Forces the RN-core overhead-reduction feature flags the benchmark's `core` build profile bakes in.
 *
 * @remarks
 * This MUST run before react-native's `Text` module evaluates and before any feature flag is read:
 * `Text` binds its implementation at module-init from `reduceDefaultPropsInText()`, and RN's `override`
 * throws if a flag was accessed before it. So keep this the very first import in `index.ts`. It touches
 * only the feature-flags submodule (which defines getters without invoking them), so importing it
 * accesses nothing.
 *
 * The flags are passed in via `EXPO_PUBLIC_BENCHMARK_RN_FLAGS` (baked into the release bundle by the
 * suite). With no flags set, `override` is never called, so the normal app and the `default` profile
 * build are completely unaffected.
 */
const raw: string = process.env.EXPO_PUBLIC_BENCHMARK_RN_FLAGS ?? '';
const baked = raw
  .split(',')
  .map((flag) => flag.trim())
  .filter((flag) => flag.length > 0);

if (baked.length > 0) {
  let featureFlags: { override: (overrides: Record<string, () => boolean>) => void } | undefined;
  try {
    featureFlags = require('react-native/src/private/featureflags/ReactNativeFeatureFlags');
  } catch {
    // Only a *missing module* is benign: older RN without the JS feature-flags module can't have these
    // flags, so `baseline-optimized` correctly equals `baseline` for that version. Errors from `override`
    // itself (e.g. it rejects because a flag was already read, violating the first-import ordering this
    // file guarantees) must surface — silently publishing baseline numbers as "core" would corrupt the
    // benchmark's whole convergence headline.
    featureFlags = undefined;
  }
  featureFlags?.override(Object.fromEntries(baked.map((name): [string, () => boolean] => [name, () => true])));
}
