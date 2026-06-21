/* eslint-disable @typescript-eslint/no-require-imports,unicorn/prefer-module */

/**
 * Forces the RN-core overhead-reduction feature flags the benchmark's `core` build profile selects.
 *
 * @remarks
 * The profile is chosen at LAUNCH (single build): a synchronous native read of the `--rn-flags=` launch
 * argument (iOS) / `rnFlags` intent extra (Android) via the TimeToRender TurboModule. It falls back to the
 * baked `EXPO_PUBLIC_BENCHMARK_RN_FLAGS` env so a legacy per-profile build still works.
 *
 * This MUST run before react-native's `Text` module evaluates and before any feature flag is read: `Text`
 * binds its implementation at module-init from `reduceDefaultPropsInText()`, and RN's `override` throws if
 * a flag was accessed before it. So keep this the very first import in `index.ts`. It deep-imports only the
 * TurboModule registry and the feature-flags submodule — neither touches RN's `Text` getters.
 *
 * With no flags selected, `override` is never called, so the normal app and the `default` profile are
 * completely unaffected.
 */

/** The `--rn-flags=` launch arg (iOS) / `rnFlags` extra (Android), read synchronously via the TurboModule
 *  before RN's Text module evaluates. Returns '' if the module isn't ready this early (→ env fallback). */
function launchArgFlags(): string {
  try {
    const registry = require('react-native/Libraries/TurboModule/TurboModuleRegistry') as {
      get: (name: string) => { getForcedFlags?: () => string } | null;
    };
    return registry.get('TimeToRender')?.getForcedFlags?.() ?? '';
  } catch {
    return '';
  }
}

const raw: string = launchArgFlags() || (process.env.EXPO_PUBLIC_BENCHMARK_RN_FLAGS ?? '');
const baked = raw
  .split(',')
  .map((flag) => flag.trim())
  .filter((flag) => flag.length > 0);

const effective: string[] = [];
if (baked.length > 0) {
  type FeatureFlags = { override: (overrides: Record<string, () => boolean>) => void };
  let featureFlags: FeatureFlags | undefined;
  try {
    featureFlags = require('react-native/src/private/featureflags/ReactNativeFeatureFlags') as FeatureFlags;
  } catch (error) {
    // Only a *missing module* is benign: older RN without the JS feature-flags module can't have these
    // flags, so `core` correctly equals `baseline` for that version. Any other failure (e.g. the module
    // throws while evaluating) must surface — silently skipping the override would run the wrong profile.
    const message = error instanceof Error ? error.message : String(error);
    if (!/cannot find module|unable to resolve module/i.test(message)) throw error;
    featureFlags = undefined;
  }
  if (featureFlags) {
    featureFlags.override(Object.fromEntries(baked.map((name): [string, () => boolean] => [name, () => true])));
    // Record only flags that actually read `true` after override — catches a silent no-op (a flag absent
    // in this RN version) so the staleness handshake can reject a profile that didn't take effect.
    const accessors = featureFlags as unknown as Record<string, () => boolean>;
    for (const name of baked) {
      const accessor = accessors[name];
      if (typeof accessor === 'function' && accessor()) effective.push(name);
    }
  }
}

/** The RN feature flags that actually read `true` after override — echoed on the staleness handshake so
 *  the host can verify the launched profile took effect (not just that the launch arg arrived). */
export const effectiveFlags: string[] = effective;
