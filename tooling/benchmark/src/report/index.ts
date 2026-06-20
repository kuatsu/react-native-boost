import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { archiveRoot, graphsDir, runDir } from '../paths.ts';
import { keyOf } from '../store.ts';
import type { BoostMode, BuildMode, FiberResult, FpsResult, Platform, RunResult } from '../schema.ts';
import { barChart, lineChart, SERIES, seriesColor, type Series, type Theme } from './svg.ts';

const PLATFORMS: Platform[] = ['ios', 'android'];
const FPS_Y_MAX = 65; // a hair above the 60 Hz ceiling
const PLATFORM_LABEL: Record<Platform, string> = { ios: 'iOS', android: 'Android' };
const MODE_LABEL: Record<BuildMode, string> = { release: 'Release', debug: 'Debug' };

const write = (file: string, content: string): void => {
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, content);
};

/** Write a chart's dark + light SVGs. `base` is the path without extension; light gets a `-light` suffix. */
function writeChart(base: string, render: (theme: Theme) => string): void {
  write(`${base}.svg`, render('dark'));
  write(`${base}-light.svg`, render('light'));
}

/** A GitHub `<picture>` that swaps the dark/light SVG by the reader's color scheme. `base` omits `.svg`. */
function chartPicture(base: string, alt: string): string {
  return [
    '<picture>',
    `  <source media="(prefers-color-scheme: dark)" srcset="${base}.svg">`,
    `  <img alt="${alt}" src="${base}-light.svg">`,
    '</picture>',
  ].join('\n');
}

const gainPct = (off: number, on: number): number => (off === 0 ? 0 : ((on - off) / off) * 100);
const reductionPct = (off: number, on: number): number => (off === 0 ? 0 : ((off - on) / off) * 100);
const fmtPct = (value: number): string => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

/** Boost-vs-baseline FPS gain at a run's heaviest load — the single number the index/trend summarize. */
function peakGain(result: FpsResult): number | undefined {
  if (result.measurements.length === 0) return undefined;
  const load = Math.max(...loadsOf(result));
  return gainPct(fpsAt(result, load, 'off'), fpsAt(result, load, 'on'));
}

function loadsOf(result: FpsResult): number[] {
  return [...new Set(result.measurements.map((m) => m.load))].sort((a, b) => a - b);
}

/** Both book sides render (and reconcile every frame) a row per level, so total rows = 2× the per-side load. */
const renderedRows = (load: number): number => load * 2;
const ROW_AXIS_LABEL = 'Text rows rendered';

const fpsAt = (result: FpsResult, load: number, boost: BoostMode): number =>
  result.measurements.find((m) => m.load === load && m.boost === boost)?.avgFps ?? 0;

/** Avg FPS vs load, baseline vs Boost. The headline graph: Boost holds its frame rate as load grows. */
function fpsChart(result: FpsResult, theme: Theme): string {
  const loads = loadsOf(result);
  const series: Series[] = [
    {
      name: 'Baseline',
      color: SERIES.baseline,
      points: loads.map((l) => ({ x: renderedRows(l), y: fpsAt(result, l, 'off') })),
    },
    {
      name: 'Boost',
      color: SERIES.boost,
      points: loads.map((l) => ({ x: renderedRows(l), y: fpsAt(result, l, 'on') })),
    },
  ];
  return lineChart(
    {
      title: `FPS @ load • ${PLATFORM_LABEL[result.platform]} • ${result.device.name} • ${MODE_LABEL[result.buildMode]}`,
      xLabel: ROW_AXIS_LABEL,
      yLabel: 'avg FPS',
      xTicks: loads.map((l) => ({ value: renderedRows(l), label: String(renderedRows(l)) })),
      yMax: FPS_Y_MAX,
    },
    series,
    theme
  );
}

/** Grouped bars of total tree nodes (≈ fibers) baseline vs Boost — the structural saving. */
function fiberChart(fibers: FiberResult, theme: Theme): string {
  const loads = fibers.measurements.map((m) => m.load);
  const series: Series[] = [
    {
      name: 'Baseline',
      color: SERIES.baseline,
      points: fibers.measurements.map((m) => ({ x: renderedRows(m.load), y: m.off.fibers })),
    },
    {
      name: 'Boost',
      color: SERIES.boost,
      points: fibers.measurements.map((m) => ({ x: renderedRows(m.load), y: m.on.fibers })),
    },
  ];
  return barChart(
    {
      title: 'React tree nodes @ load',
      xLabel: ROW_AXIS_LABEL,
      yLabel: 'tree nodes (≈ fibers)',
      xTicks: loads.map((l) => ({ value: renderedRows(l), label: String(renderedRows(l)) })),
    },
    series,
    theme
  );
}

/** Cross-version: Boost FPS gain (%) at each run's heaviest load, one line per platform, oldest→newest. */
function trendChart(runs: RunResult[], theme: Theme): string | null {
  const ordered = [...runs].reverse(); // listRuns is newest-first
  if (ordered.length < 2) return null; // a one-point "trend" is noise
  const versions = ordered.map((r) => r.context.rnVersion);
  const series: Series[] = PLATFORMS.flatMap((platform, index) => {
    const points = ordered
      .map((run, x) => {
        const result = run.fps[platform];
        const gain = result ? peakGain(result) : undefined;
        return gain === undefined ? null : { x, y: gain };
      })
      .filter((p): p is { x: number; y: number } => p !== null);
    return points.length > 0 ? [{ name: platform, color: seriesColor(index), points }] : [];
  });
  if (series.length === 0) return null;
  const yMax = Math.max(10, ...series.flatMap((s) => s.points.map((p) => p.y))) * 1.15;
  return lineChart(
    {
      title: 'Boost FPS gain across React Native versions (heaviest load)',
      xLabel: 'React Native version',
      yLabel: 'FPS gain %',
      xTicks: versions.map((v, i) => ({ value: i, label: v })),
      yMax,
    },
    series,
    theme
  );
}

function fpsTable(result: FpsResult): string {
  const rows = loadsOf(result).map((load) => {
    const off = result.measurements.find((m) => m.load === load && m.boost === 'off');
    const on = result.measurements.find((m) => m.load === load && m.boost === 'on');
    const gain = off && on ? fmtPct(gainPct(off.avgFps, on.avgFps)) : '—';
    return `| ${renderedRows(load)} | ${off?.avgFps ?? '—'} | ${on?.avgFps ?? '—'} | ${gain} | ${off?.p95FrameMs ?? '—'} | ${on?.p95FrameMs ?? '—'} | ${off?.droppedPct ?? '—'}% → ${on?.droppedPct ?? '—'}% |`;
  });
  return [
    `#### ${PLATFORM_LABEL[result.platform]} — ${result.device.name} (${result.device.kind}, ${PLATFORM_LABEL[result.platform]} ${result.device.osVersion}), ${MODE_LABEL[result.buildMode]}`,
    '',
    '| Text rows | Baseline FPS | Boost FPS | Gain | Baseline p95 ms | Boost p95 ms | Dropped |',
    '| ---: | ---: | ---: | ---: | ---: | ---: | :--- |',
    ...rows,
    '',
    chartPicture(`./graphs/fps-${result.platform}`, 'FPS @ load'),
    '',
  ].join('\n');
}

function fiberTable(fibers: FiberResult): string {
  const rows = fibers.measurements.map(
    (m) =>
      `| ${renderedRows(m.load)} | ${m.off.fibers} | ${m.on.fibers} | ${m.saved.fibers} | ${fmtPct(reductionPct(m.off.fibers, m.on.fibers))} |`
  );
  return [
    `### Fiber savings — ${fibers.perRow.fibersOff} → ${fibers.perRow.fibersOn} nodes per row (saves ${fibers.perRow.savedPerRow})`,
    '',
    '| Text rows | Baseline nodes | Boost nodes | Saved | Reduction |',
    '| ---: | ---: | ---: | ---: | ---: |',
    ...rows,
    '',
    chartPicture('./graphs/fibers', 'Tree nodes @ load'),
    '',
  ].join('\n');
}

function runMarkdown(run: RunResult): string {
  const { context } = run;
  const lines = [
    `# Benchmark — RN ${context.rnVersion} × Boost ${context.boostVersion}`,
    '',
    `- **React**: ${context.reactVersion}`,
    `- **Commit**: \`${context.gitSha}\``,
    `- **Captured**: ${context.timestamp}`,
    `- **Sweep**: ${context.sweep.loads.join(', ')} rows/side · warmup ${context.sweep.warmupMs}ms · capture ${context.sweep.captureMs}ms`,
    `- **Text rows** = rows mounted & reconciled each frame across both book sides (2× the per-side \`--loads\` sweep; only ~13/side are visible, the rest reconcile but clip off-screen)`,
    '',
    '## FPS',
    '',
  ];
  for (const platform of PLATFORMS) {
    const result = run.fps[platform];
    if (result) lines.push(fpsTable(result));
  }
  if (run.fibers) {
    lines.push('## Fibers', '', fiberTable(run.fibers));
  }
  return `${lines.join('\n')}\n`;
}

function archiveIndexMarkdown(runs: RunResult[], hasTrend: boolean): string {
  const rows = runs.map((run) => {
    const cell = (platform: Platform): string => {
      const result = run.fps[platform];
      const gain = result ? peakGain(result) : undefined;
      return gain === undefined ? '—' : fmtPct(gain);
    };
    const dir = `results/rn-${run.context.rnVersion}/boost-${run.context.gitSha}`;
    const boost = `${run.context.boostVersion} (\`${run.context.gitSha}\`)`;
    return `| [${run.context.rnVersion}](./${dir}/report.md) | ${boost} | ${cell('ios')} | ${cell('android')} | ${run.fibers?.perRow.savedPerRow ?? '—'} |`;
  });
  return [
    '# React Native Boost — benchmark archive',
    '',
    'Render-bound benchmark: a long, live-updating list whose rows are clusters of `Text` cells. FPS gain is',
    'Boost vs baseline at each run’s heaviest load.',
    '',
    '| RN | Boost | iOS gain | Android gain | Saved nodes/row |',
    '| --- | --- | ---: | ---: | ---: |',
    ...rows,
    '',
    ...(hasTrend ? [chartPicture('./graphs/trend', 'Boost FPS gain across React Native versions'), ''] : []),
  ].join('\n');
}

/** Write one run's graphs (dark + light) + report into its archive dir. */
export function writeRunReport(run: RunResult): void {
  const dir = runDir(keyOf(run.context));
  for (const platform of PLATFORMS) {
    const result = run.fps[platform];
    if (result) writeChart(join(dir, 'graphs', `fps-${platform}`), (theme) => fpsChart(result, theme));
  }
  const { fibers } = run;
  if (fibers) writeChart(join(dir, 'graphs', 'fibers'), (theme) => fiberChart(fibers, theme));
  write(join(dir, 'report.md'), runMarkdown(run));
}

/** Regenerate the repo-level archive index + cross-version trend from every archived run. */
export function writeArchiveIndex(allRuns: RunResult[]): void {
  const darkTrend = trendChart(allRuns, 'dark');
  if (darkTrend) {
    write(join(graphsDir(), 'trend.svg'), darkTrend);
    write(join(graphsDir(), 'trend-light.svg'), trendChart(allRuns, 'light') ?? darkTrend);
  }
  write(join(archiveRoot(), '..', 'README.md'), archiveIndexMarkdown(allRuns, darkTrend !== null));
}

/** Write a run's report and refresh the archive index — the per-sweep entry point. */
export function writeReport(run: RunResult, allRuns: RunResult[]): void {
  writeRunReport(run);
  writeArchiveIndex(allRuns);
}
