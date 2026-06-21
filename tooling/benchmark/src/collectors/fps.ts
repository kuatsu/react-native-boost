import { BUILD_PROFILES, DEFAULT_SERVER_PORT } from '../config.ts';
import { detectDevice, resolveHost } from '../device.ts';
import { launchApp } from '../driver.ts';
import { startServer } from '../server.ts';
import type {
  BenchmarkPlan,
  BoostMode,
  BuildMode,
  DeviceInfo,
  FpsMeasurement,
  FpsResult,
  Platform,
  ProfileSpec,
  SweepConfig,
} from '../schema.ts';

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export interface FpsOptions {
  platform: Platform;
  buildMode: BuildMode;
  sweep: SweepConfig;
  port?: number;
  /** Order of A/B runs; baseline first by default so Boost gains read as the improvement. */
  boostModes?: BoostMode[];
  /** Build-flag profiles to sweep, each a separate build (the orthogonal, build-time axis). */
  profiles?: ProfileSpec[];
  log?: (message: string) => void;
}

interface SweepArgs {
  device: DeviceInfo;
  host: string;
  port: number;
  buildMode: BuildMode;
  sweep: SweepConfig;
  boostModes: BoostMode[];
  profile: ProfileSpec;
  log: (message: string) => void;
}

/**
 * One profile's build + sweep: stand up the control server, build + launch the app with this profile's
 * RN flags baked in, verify the running bundle echoes those flags (staleness handshake), then gather the
 * samples it streams back. Each call fully releases the port before returning, so profiles run serially.
 */
async function sweepProfile(args: SweepArgs): Promise<FpsMeasurement[]> {
  const { device, host, port, buildMode, sweep, boostModes, profile, log } = args;
  const plan: BenchmarkPlan = {
    loads: sweep.loads,
    warmupMs: sweep.warmupMs,
    captureMs: sweep.captureMs,
    tickMs: sweep.tickMs,
    boostModes,
  };
  const configs = boostModes.length * sweep.loads.length;
  const expectedFlags = profile.rnFlags.join(',');

  const server = startServer(plan, port, (sample, index) =>
    log(
      `  [${index + 1}/${configs}] ${sample.boost} @ ${sample.load}: ` +
        `${sample.avgFps} fps (p95 ${sample.p95FrameMs}ms, dropped ${sample.droppedPct}%)`
    )
  );
  server.done.catch(() => {}); // may reject via close() after the race already settled — keep it handled

  try {
    log(`server on http://${host}:${port} — building + launching ${buildMode} app (this can take a few minutes)…`);
    const { child, buildFailure } = launchApp(device, buildMode, {
      EXPO_PUBLIC_BENCHMARK: '1',
      EXPO_PUBLIC_BENCHMARK_SERVER: `http://${host}:${port}`,
      EXPO_PUBLIC_BENCHMARK_RN_FLAGS: expectedFlags,
    });
    buildFailure.catch(() => {}); // may reject after the race settles (e.g. debug Metro killed on cleanup)

    try {
      // The build is unbounded (minutes), so don't count it against the sweep: wait for the app to make
      // first contact, then give the sweep its own budget.
      const buildTimeout = 25 * 60_000;
      const contact = await withTimeout(
        Promise.race([server.firstContact, buildFailure]),
        buildTimeout,
        'app never reached the server — the build or launch likely failed'
      );
      // Staleness handshake: a cached release bundle that ignored the changed env would silently run the
      // wrong profile (→ baseline-optimized == baseline). Fail loudly instead of publishing bad data.
      if (contact.flags !== expectedFlags) {
        throw new Error(
          `profile mismatch: the running bundle baked flags "${contact.flags}" but profile ` +
            `"${profile.id}" expects "${expectedFlags}" — the release JS bundle is stale (the env was not ` +
            `picked up). Rebuild the app for this profile.`
        );
      }
      log(`app launched (profile "${profile.id}") — running sweep…`);

      const sweepBudget = configs * (sweep.warmupMs + sweep.captureMs) + 30_000; // + slack per config
      const samples = await withTimeout(
        Promise.race([server.done, buildFailure]),
        sweepBudget,
        `sweep did not finish within ${Math.round(sweepBudget / 1000)}s`
      );
      return samples.map((sample) => ({ ...sample, profile: profile.id }));
    } finally {
      child.kill('SIGINT'); // stop a debug Metro / any lingering process
    }
  } finally {
    await server.close(); // fully release the port before the next profile/platform re-binds it
  }
}

/**
 * End-to-end FPS collection for one platform: auto-detect a target once, then for each build-flag profile
 * build + launch the self-driving app and gather the samples it streams back, stamped with that profile.
 * The app drives itself, so this works headless in release.
 */
export async function collectFps(options: FpsOptions): Promise<FpsResult> {
  const {
    platform,
    buildMode,
    sweep,
    port = DEFAULT_SERVER_PORT,
    boostModes = ['off', 'on'],
    profiles = BUILD_PROFILES,
    log = () => {},
  } = options;

  const device = detectDevice(platform);
  log(`target: ${device.name} — ${device.kind}, ${platform} ${device.osVersion}`);
  const host = resolveHost(device);

  const measurements: FpsMeasurement[] = [];
  for (const profile of profiles) {
    const flagNote = profile.rnFlags.length > 0 ? ` — flags: ${profile.rnFlags.join(', ')}` : '';
    log(`profile "${profile.id}" (${profile.label})${flagNote}`);
    const profileMeasurements = await sweepProfile({
      device,
      host,
      port,
      buildMode,
      sweep,
      boostModes,
      profile,
      log,
    });
    for (const measurement of profileMeasurements) measurements.push(measurement);
  }
  return { platform, buildMode, device, measurements };
}
