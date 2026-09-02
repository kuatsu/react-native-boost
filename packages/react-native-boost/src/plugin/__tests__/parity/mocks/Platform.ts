import { createRequire } from 'node:module';

// Switchable Platform mock. `Text.js` reads `Platform.OS` / `Platform.select` at render time, so the
// parity test flips the OS via `setPlatformOS` before each wrapper render.
export type PlatformOS = 'ios' | 'android';

let os: PlatformOS = 'ios';

export function setPlatformOS(value: PlatformOS) {
  os = value;
}

// The Boost runtime's Image gates branch on `constants.reactNativeVersion`, and the wrapper side of
// every parity case is the RN installed in this repo — so the mock reports that same version. Both
// sides of the comparison therefore flip together whenever the devDependency moves, instead of the
// suite needing a hand-maintained list of expected divergences.
const { version } = createRequire(import.meta.url)('react-native/package.json') as { version: string };
const [major, minor, patch] = version.split('-')[0]!.split('.').map(Number);
export const reactNativeVersion = { major, minor, patch };

const Platform = {
  get OS() {
    return os;
  },
  constants: { reactNativeVersion },
  select<T>(spec: Record<string, T>): T | undefined {
    return os in spec ? spec[os] : spec.default;
  },
};

export default Platform;
