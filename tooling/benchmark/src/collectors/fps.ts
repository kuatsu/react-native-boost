import {
  BUILD_PROFILES,
  DEFAULT_ORDER,
  DEFAULT_REPLICATES,
  DEFAULT_SEED,
  DEFAULT_SERVER_PORT,
  DEFAULT_THERMAL,
} from '../config.ts';
import { detectDevice, resolveHost } from '../device.ts';
import { buildAndInstall, relaunchWithProfile } from '../driver.ts';
import { startServer } from '../server.ts';
import type {
  BenchmarkPlan,
  BoostMode,
  BuildMode,
  DeviceInfo,
  FpsMeasurement,
  FpsResult,
  FpsSample,
  OrderMode,
  Platform,
  ProfileSpec,
  SweepConfig,
  ThermalPolicy,
} from '../schema.ts';

/** Surface the budget-focus down-sampling the app applied: loads pinned at the refresh ceiling get fewer
 *  replicates (no FPS signal there). Reporting it keeps the truncation explicit, never silent. */
function reportBudgetFocus(samples: FpsSample[], fullPerLoad: number, log: (message: string) => void): void {
  const perLoad = new Map<number, number>();
  for (const sample of samples) perLoad.set(sample.load, (perLoad.get(sample.load) ?? 0) + 1);
  const downsampled: number[] = [];
  for (const [load, count] of perLoad) if (count < fullPerLoad) downsampled.push(load);
  if (downsampled.length > 0) {
    downsampled.sort((a, b) => a - b);
    log(
      `  budget focus: ${downsampled.length} load(s) pinned at the refresh ceiling → fewer replicates: ${downsampled.join(', ')}`
    );
  }
}

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
  /** Per-capture thermal gating policy; defaults to DEFAULT_THERMAL. */
  thermal?: ThermalPolicy;
  /** How many times to measure each (boost, load) cell; defaults to DEFAULT_REPLICATES. */
  replicates?: number;
  /** Load visitation order across passes; defaults to DEFAULT_ORDER. */
  order?: OrderMode;
  /** Seed for the 'shuffle' order; defaults to DEFAULT_SEED. */
  seed?: number;
  log?: (message: string) => void;
}

interface SweepArgs {
  device: DeviceInfo;
  port: number;
  plan: BenchmarkPlan;
  profile: ProfileSpec;
  log: (message: string) => void;
}

/** Normalize a flag set to a comparable string (trimmed, non-empty, sorted) for the handshake. */
const normalizeFlags = (flags: string[]): string =>
  flags
    .map((flag) => flag.trim())
    .filter((flag) => flag.length > 0)
    .sort()
    .join(',');

/**
 * One profile's sweep against an already-installed build: stand up the control server, relaunch the app
 * with this profile's RN flags as a launch argument, verify the app reports those flags as *effective*
 * (the handshake — catches a launch arg that didn't arrive or an override that silently no-op'd), then
 * gather the samples it streams back. Fully releases the port before returning, so profiles run serially.
 */
async function sweepProfile(args: SweepArgs): Promise<FpsMeasurement[]> {
  const { device, port, plan, profile, log } = args;
  const expectedFlags = normalizeFlags(profile.rnFlags);
  // Upper bound on captures: the app may take fewer (budget focus down-samples clamped loads to 1 replicate).
  const maxConfigs = plan.boostModes.length * plan.loads.length * plan.replicates;

  const server = startServer(plan, port, (sample, index) =>
    log(
      `  [${index + 1}] ${sample.boost} @ ${sample.load} (rep ${sample.replicate + 1}): ` +
        `${sample.avgFps} fps (p95 ${sample.p95FrameMs}ms, dropped ${sample.droppedPct}%, ` +
        `thermal ${sample.thermalStart}→${sample.thermalEnd})`
    )
  );
  server.done.catch(() => {}); // may reject via close() after the race already settled — keep it handled

  try {
    relaunchWithProfile(device, profile);
    // Relaunch is seconds, but the cooldown gate can hold the app on the idle screen before first contact —
    // give it a generous window.
    const contact = await withTimeout(
      server.firstContact,
      2 * 60_000,
      `app never reached the server after relaunch (profile "${profile.id}") — the launch failed`
    );
    // Handshake: the app echoes the flags that actually read `true` after override. A mismatch means the
    // launch arg didn't arrive or the override silently no-op'd — fail loudly instead of publishing noise.
    const actualFlags = normalizeFlags(contact.flags.split(','));
    if (actualFlags !== expectedFlags) {
      throw new Error(
        `profile "${profile.id}" mismatch: relaunched with flags "${expectedFlags || '(none)'}" but the ` +
          `app reports effective flags "${actualFlags || '(none)'}" — the launch arg didn't arrive or the ` +
          `override silently no-op'd.`
      );
    }
    log(`app launched (profile "${profile.id}") — running sweep…`);

    // Each config may also spend up to a full cooldown wait before its capture — budget for it.
    const sweepBudget = maxConfigs * (plan.thermalMaxWaitMs + plan.warmupMs + plan.captureMs) + 30_000;
    const samples = await withTimeout(
      server.done,
      sweepBudget,
      `sweep did not finish within ${Math.round(sweepBudget / 1000)}s`
    );
    reportBudgetFocus(samples, plan.boostModes.length * plan.replicates, log);
    return samples.map((sample) => ({ ...sample, profile: profile.id }));
  } finally {
    await server.close(); // fully release the port before the next profile re-binds it
  }
}

/**
 * End-to-end FPS collection for one platform: auto-detect a target, build + install the app **once**, then
 * for each build-flag profile relaunch it with that profile's flags as a launch argument and gather the
 * samples it streams back. One build (no per-profile rebuild) keeps the profiles seconds apart at the same
 * thermal floor, so the cross-build drift that corrupted the old anchor can't arise.
 */
export async function collectFps(options: FpsOptions): Promise<FpsResult> {
  const {
    platform,
    buildMode,
    sweep,
    port = DEFAULT_SERVER_PORT,
    boostModes = ['off', 'on'],
    profiles = BUILD_PROFILES,
    thermal = DEFAULT_THERMAL,
    replicates = DEFAULT_REPLICATES,
    order = DEFAULT_ORDER,
    seed = DEFAULT_SEED,
    log = () => {},
  } = options;

  const device = detectDevice(platform);
  log(`target: ${device.name} — ${device.kind}, ${platform} ${device.osVersion}`);
  const host = resolveHost(device);

  const plan: BenchmarkPlan = {
    loads: sweep.loads,
    warmupMs: sweep.warmupMs,
    captureMs: sweep.captureMs,
    tickMs: sweep.tickMs,
    boostModes,
    thermalFloor: thermal.floor,
    thermalMaxWaitMs: thermal.maxWaitMs,
    thermalPollMs: thermal.pollMs,
    replicates,
    order,
    seed,
  };

  log(`building + installing ${buildMode} app once (this can take a few minutes)…`);
  await withTimeout(
    buildAndInstall(device, buildMode, {
      EXPO_PUBLIC_BENCHMARK: '1',
      EXPO_PUBLIC_BENCHMARK_SERVER: `http://${host}:${port}`,
    }),
    25 * 60_000,
    'build/install did not finish within 25 minutes'
  );

  const measurements: FpsMeasurement[] = [];
  for (const profile of profiles) {
    const flagNote = profile.rnFlags.length > 0 ? ` — flags: ${profile.rnFlags.join(', ')}` : '';
    log(`profile "${profile.id}" (${profile.label})${flagNote}`);
    const profileMeasurements = await sweepProfile({ device, port, plan, profile, log });
    for (const measurement of profileMeasurements) measurements.push(measurement);
  }
  return { platform, buildMode, device, measurements };
}
