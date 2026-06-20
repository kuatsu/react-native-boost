import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { exampleDir } from './paths.ts';
import type { BuildMode, DeviceInfo } from './schema.ts';

function expoArgs(device: DeviceInfo, buildMode: BuildMode): string[] {
  // Release embeds the JS bundle (env baked in at build time), so no Metro dev server is needed and the
  // process exits after launch. Debug keeps Metro attached.
  const release = buildMode === 'release';
  if (device.platform === 'ios') {
    // iOS resolves a simulator/device by UDID.
    return [
      'expo',
      'run:ios',
      '--device',
      device.id,
      ...(release ? ['--configuration', 'Release', '--no-bundler'] : []),
    ];
  }
  // Android's `--device` matches AVD names, not adb serials — target via ANDROID_SERIAL (set in launchApp).
  return ['expo', 'run:android', ...(release ? ['--variant', 'release', '--no-bundler'] : [])];
}

export interface Launch {
  child: ChildProcess;
  /** Rejects only on a non-zero exit (a build/install failure). A clean exit is expected for release
   *  builds — the app keeps running after the process detaches — so it intentionally never resolves. */
  buildFailure: Promise<never>;
}

/**
 * Build, install, and launch the example app on `device` via the Expo CLI, with the benchmark env baked
 * into the (release) JS bundle. Reuses the existing native project for an incremental build.
 */
export function launchApp(device: DeviceInfo, buildMode: BuildMode, env: Record<string, string>): Launch {
  // Refresh the `.unoptimized` twins the A/B render depends on (the `preios`/`preandroid` hooks are
  // bypassed by calling the Expo CLI directly).
  execFileSync('node', ['scripts/gen-unoptimized.mjs'], { cwd: exampleDir(), stdio: 'ignore' });

  const args = expoArgs(device, buildMode);
  // ANDROID_SERIAL pins adb (and Expo's install/launch) to the detected emulator/device.
  const targeting = device.platform === 'android' ? { ANDROID_SERIAL: device.id } : {};
  const child = spawn('pnpm', ['exec', ...args], {
    cwd: exampleDir(),
    stdio: 'inherit',
    env: { ...process.env, ...env, ...targeting },
  });
  const buildFailure = new Promise<never>((_resolve, reject) => {
    child.on('exit', (code) => {
      if (code !== null && code !== 0) reject(new Error(`\`expo ${args[1]}\` exited with code ${code}`));
    });
    child.on('error', reject);
  });
  return { child, buildFailure };
}
