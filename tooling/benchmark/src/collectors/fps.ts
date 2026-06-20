import { DEFAULT_SERVER_PORT } from '../config.ts';
import { detectDevice, resolveHost } from '../device.ts';
import { launchApp } from '../driver.ts';
import { startServer } from '../server.ts';
import type { BenchmarkPlan, BoostMode, BuildMode, FpsResult, Platform, SweepConfig } from '../schema.ts';

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
  log?: (message: string) => void;
}

/**
 * End-to-end FPS collection for one platform: auto-detect a target, stand up the control server, build +
 * launch the self-driving app against it, and gather the measurements it streams back. The app drives
 * itself, so this works headless in release.
 */
export async function collectFps(options: FpsOptions): Promise<FpsResult> {
  const {
    platform,
    buildMode,
    sweep,
    port = DEFAULT_SERVER_PORT,
    boostModes = ['off', 'on'],
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
  };
  const configs = boostModes.length * sweep.loads.length;

  const server = startServer(plan, port, (measurement, index) =>
    log(
      `  [${index + 1}/${configs}] ${measurement.boost} @ ${measurement.load}: ` +
        `${measurement.avgFps} fps (p95 ${measurement.p95FrameMs}ms, dropped ${measurement.droppedPct}%)`
    )
  );
  server.done.catch(() => {}); // may reject via close() after the race already settled — keep it handled

  try {
    log(`server on http://${host}:${port} — building + launching ${buildMode} app (this can take a few minutes)…`);
    const { child, buildFailure } = launchApp(device, buildMode, {
      EXPO_PUBLIC_BENCHMARK: '1',
      EXPO_PUBLIC_BENCHMARK_SERVER: `http://${host}:${port}`,
    });
    buildFailure.catch(() => {}); // may reject after the race settles (e.g. debug Metro killed on cleanup)

    try {
      // The build is unbounded (minutes), so don't count it against the sweep: wait for the app to make
      // first contact, then give the sweep its own budget.
      const buildTimeout = 25 * 60_000;
      await withTimeout(
        Promise.race([server.firstContact, buildFailure]),
        buildTimeout,
        'app never reached the server — the build or launch likely failed'
      );
      log('app launched — running sweep…');

      const sweepBudget = configs * (sweep.warmupMs + sweep.captureMs) + 30_000; // + slack per config
      const measurements = await withTimeout(
        Promise.race([server.done, buildFailure]),
        sweepBudget,
        `sweep did not finish within ${Math.round(sweepBudget / 1000)}s`
      );
      return { platform, buildMode, device, measurements };
    } finally {
      child.kill('SIGINT'); // stop a debug Metro / any lingering process
    }
  } finally {
    await server.close(); // fully release the port before the next platform re-binds it
  }
}
