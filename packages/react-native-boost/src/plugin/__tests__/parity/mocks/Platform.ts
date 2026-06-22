// Switchable Platform mock. `Text.js` reads `Platform.OS` / `Platform.select` at render time, so the
// parity test flips the OS via `setPlatformOS` before each wrapper render.
export type PlatformOS = 'ios' | 'android';

let os: PlatformOS = 'ios';

export function setPlatformOS(value: PlatformOS) {
  os = value;
}

const Platform = {
  get OS() {
    return os;
  },
  select<T>(spec: Record<string, T>): T | undefined {
    return os in spec ? spec[os] : spec.default;
  },
};

export default Platform;
