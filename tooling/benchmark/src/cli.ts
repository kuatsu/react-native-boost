import process from 'node:process';
import { collectFibers } from './collectors/fibers.ts';
import { collectFps } from './collectors/fps.ts';
import { DEFAULT_SERVER_PORT, DEFAULT_SWEEP } from './config.ts';
import { resolveContext } from './context.ts';
import { detectDevice } from './device.ts';
import { writeArchiveIndex, writeReport, writeRunReport } from './report/index.ts';
import { keyOf, listRuns, loadRun, saveContext, saveFibers, saveFps } from './store.ts';
import type { BuildMode, Platform, SweepConfig } from './schema.ts';

type Flags = Record<string, string | true>;

function parseArgs(argv: string[]): Flags {
  const flags: Flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i++;
    }
  }
  return flags;
}

/** Validate a flag's value against an allowed set, failing loudly instead of casting a typo through. */
function oneOf<T extends string>(value: string | true | undefined, allowed: readonly T[], flag: string): T | undefined {
  if (value === undefined) return undefined;
  if (value === true || !allowed.includes(value as T)) {
    throw new Error(`--${flag} must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

const log = (message: string): void => {
  console.log(message);
};

async function main(): Promise<void> {
  const flags = parseArgs(process.argv.slice(2));

  const loads = typeof flags.loads === 'string' ? flags.loads.split(',').map(Number) : undefined;
  if (loads && (loads.length === 0 || loads.some((n) => !Number.isFinite(n) || n <= 0))) {
    throw new Error('--loads must be comma-separated positive numbers (rows rendered per side)');
  }
  const sweep: SweepConfig = { ...DEFAULT_SWEEP, ...(loads ? { loads } : {}) };
  const buildMode: BuildMode = oneOf(flags.mode, ['release', 'debug'] as const, 'mode') ?? 'release';
  const port = typeof flags.port === 'string' ? Number(flags.port) : DEFAULT_SERVER_PORT;
  const only = oneOf(flags.only, ['fibers', 'fps'] as const, 'only');
  const explicitPlatform = typeof flags.platform === 'string';
  const platforms: Platform[] = explicitPlatform
    ? (flags.platform as string).split(',').map((p) => oneOf(p.trim(), ['ios', 'android'] as const, 'platform')!)
    : ['ios', 'android'];

  const context = resolveContext(sweep, new Date().toISOString());
  const key = keyOf(context);
  log(
    `React Native ${context.rnVersion} · React ${context.reactVersion} · Boost ${context.boostVersion} · ${context.gitSha}`
  );

  // Regenerate every archived run's graphs + the index once, no new capture.
  if (flags['report-only']) {
    const runs = listRuns();
    for (const run of runs) writeRunReport(run);
    writeArchiveIndex(runs);
    log(`regenerated reports for ${runs.length} archived run(s)`);
    return;
  }

  saveContext(context);

  if (only !== 'fps') {
    log('• fibers — structural saving (headless)…');
    const fibers = collectFibers(sweep);
    saveFibers(key, fibers);
    log(`  ${fibers.perRow.fibersOff} → ${fibers.perRow.fibersOn} nodes/row (saves ${fibers.perRow.savedPerRow})`);
  }

  if (only !== 'fibers') {
    for (const platform of platforms) {
      try {
        detectDevice(platform);
      } catch (error) {
        if (explicitPlatform) throw error;
        log(`• ${platform} — skipped: ${(error as Error).message}`);
        continue;
      }
      log(`• ${platform} — FPS sweep`);
      saveFps(key, await collectFps({ platform, buildMode, sweep, port, log }));
    }
  }

  const run = loadRun(key);
  if (run) {
    writeReport(run, listRuns());
    log(`✓ report → benchmarks/results/rn-${key.rnVersion}/boost-${key.boostSha}/report.md`);
  }
}

main().catch((error: Error) => {
  console.error(`benchmark failed: ${error.message}`);
  process.exitCode = 1;
});
