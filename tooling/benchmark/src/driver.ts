import { execFileSync, spawn } from 'node:child_process';
import { exampleDir } from './paths.ts';
import type { BuildMode, DeviceInfo, ProfileSpec } from './schema.ts';

const IOS_BUNDLE_ID = 'com.kuatsu-mkrause.react-native-boost-example';
const ANDROID_PACKAGE = 'com.kuatsumkrause.reactnativeboostexample';
const ANDROID_ACTIVITY = '.MainActivity';

function expoArgs(device: DeviceInfo): string[] {
  // The benchmark only measures release: the JS bundle is embedded (env baked at build time), no Metro dev
  // server is needed, and the CLI process exits after install+launch — that exit is the build-done signal.
  if (device.platform === 'ios') {
    return ['expo', 'run:ios', '--device', device.id, '--configuration', 'Release', '--no-bundler'];
  }
  // Android's `--device` matches AVD names, not adb serials — target via ANDROID_SERIAL (set in buildAndInstall).
  return ['expo', 'run:android', '--variant', 'release', '--no-bundler'];
}

/** Best-effort exec that ignores failures — e.g. terminating an app instance that may not be running. */
function tryExecFile(command: string, args: string[]): void {
  try {
    execFileSync(command, args, { stdio: 'ignore' });
  } catch {
    // ignore
  }
}

/**
 * Build + install the example app on `device` once (release). The profile is **not** baked — it's selected
 * per launch by `relaunchWithProfile`, so the whole sweep runs against one build (no per-profile rebuild,
 * no cross-build thermal drift). Release `expo run:*` builds, installs, launches once, then the CLI process
 * exits; that clean exit is the build-done signal. Resolves on success, rejects on a build/install failure.
 */
export function buildAndInstall(device: DeviceInfo, buildMode: BuildMode, env: Record<string, string>): Promise<void> {
  if (buildMode !== 'release') {
    return Promise.reject(
      new Error('launch-arg profile selection requires --mode release (debug keeps Metro attached and never detaches)')
    );
  }
  // Refresh the `.unoptimized` twins the A/B render depends on (the `preios`/`preandroid` hooks are
  // bypassed by calling the Expo CLI directly).
  execFileSync('node', ['scripts/gen-unoptimized.mjs'], { cwd: exampleDir(), stdio: 'ignore' });

  const args = expoArgs(device);
  // ANDROID_SERIAL pins adb (and Expo's install/launch) to the detected emulator/device.
  const targeting = device.platform === 'android' ? { ANDROID_SERIAL: device.id } : {};
  const child = spawn('pnpm', ['exec', ...args], {
    cwd: exampleDir(),
    stdio: 'inherit',
    env: { ...process.env, ...env, ...targeting },
  });
  return new Promise<void>((resolve, reject) => {
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`\`expo ${args[1]}\` exited with code ${code}`))
    );
    child.on('error', reject);
  });
}

/**
 * Terminate any running instance and relaunch the installed app with `profile`'s RN flags passed as a
 * launch argument (`--rn-flags=` on iOS, `rnFlags` intent extra on Android), so the profile is selected at
 * launch. Synchronous: the launch command returns once the OS has started the app (it then runs detached);
 * whether it actually came up is confirmed by the server handshake, not here.
 */
export function relaunchWithProfile(device: DeviceInfo, profile: ProfileSpec): void {
  const flags = profile.rnFlags.join(',');
  if (device.platform === 'ios') {
    if (device.kind === 'simulator') {
      tryExecFile('xcrun', ['simctl', 'terminate', device.id, IOS_BUNDLE_ID]);
      execFileSync('xcrun', ['simctl', 'launch', device.id, IOS_BUNDLE_ID, `--rn-flags=${flags}`], { stdio: 'ignore' });
    } else {
      execFileSync(
        'xcrun',
        [
          'devicectl',
          'device',
          'process',
          'launch',
          '--device',
          device.id,
          '--terminate-existing',
          IOS_BUNDLE_ID,
          `--rn-flags=${flags}`,
        ],
        { stdio: 'ignore' }
      );
    }
    return;
  }
  // force-stop ends the singleTask process so a fresh JS init reads the new intent extra.
  tryExecFile('adb', ['-s', device.id, 'shell', 'am', 'force-stop', ANDROID_PACKAGE]);
  // `am start --es rnFlags ''` is malformed (empty extra value) — omit the extra for the flag-less default
  // profile; with no extra, getForcedFlags() returns '' → default, exactly as intended.
  const startArgs = ['-s', device.id, 'shell', 'am', 'start', '-n', `${ANDROID_PACKAGE}/${ANDROID_ACTIVITY}`];
  if (flags.length > 0) startArgs.push('--es', 'rnFlags', flags);
  execFileSync('adb', startArgs, { stdio: 'ignore' });
}
