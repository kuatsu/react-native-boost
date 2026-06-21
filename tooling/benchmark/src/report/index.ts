import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { archiveRoot, graphsDir, runDir } from '../paths.ts';
import { keyOf } from '../store.ts';
import type { BuildMode, FiberResult, FpsResult, Platform, RunResult } from '../schema.ts';
import {
  anchoredCore,
  anchorWarnings,
  convergencePoints,
  coreValidAt,
  fpsAt,
  gainPct,
  isThermalRun,
  loadsOf,
  peakBoostGain,
  peakCoreGain,
  validate,
  worstThermalLevel,
} from './analysis.ts';
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

const reductionPct = (off: number, on: number): number => (off === 0 ? 0 : ((off - on) / off) * 100);
const fmtPct = (value: number): string => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
const round1 = (value: number): number => Math.round(value * 10) / 10;

/** Both book sides render (and reconcile every frame) a row per level, so total rows = 2× the per-side load. */
const renderedRows = (load: number): number => load * 2;
const ROW_AXIS_LABEL = 'Text rows rendered';

/** Informational note on the hottest thermal level the run's captures hit; empty for legacy (no signal). */
function thermalNote(result: FpsResult): string[] {
  const worst = worstThermalLevel(result);
  return worst === null ? [] : [`> Hottest device thermal level during capture: **${worst}**.`, ''];
}

/** Whether a result holds both profiles and so renders the anchored three-series convergence view. */
const isConvergence = (result: FpsResult): boolean => anchoredCore(result) !== undefined;
const runHasCore = (run: RunResult): boolean =>
  PLATFORMS.some((platform) => {
    const result = run.fps[platform];
    return result ? isConvergence(result) : false;
  });

/** Avg FPS vs load, baseline vs Boost (plus the core-optimized series when both profiles ran). The headline
 *  graph: Boost holds its frame rate as load grows, and how far core has closed the gap. Thermal runs draw
 *  direct medians with replicate whiskers and suppress the core series if validation failed; legacy runs use
 *  the anchored core curve (unchanged). */
function fpsChart(result: FpsResult, theme: Theme): string {
  const loads = loadsOf(result);
  const options = {
    title: `FPS @ load • ${PLATFORM_LABEL[result.platform]} • ${result.device.name} • ${MODE_LABEL[result.buildMode]}`,
    xLabel: ROW_AXIS_LABEL,
    yLabel: 'avg FPS',
    xTicks: loads.map((l) => ({ value: renderedRows(l), label: String(renderedRows(l)) })),
    yMax: FPS_Y_MAX,
    // The FPS curves sit high-left and descend right, leaving the bottom-left corner empty.
    legendPosition: 'bottom-left' as const,
  };

  const points = isThermalRun(result) ? convergencePoints(result) : undefined;
  if (points) {
    const report = validate(result);
    const whisker = (load: number, value: number, iqr: number): { x: number; lo: number; hi: number } => ({
      x: renderedRows(load),
      lo: Math.max(0, value - iqr / 2),
      hi: value + iqr / 2,
    });
    const series: Series[] = [
      {
        name: 'Baseline',
        color: SERIES.baseline,
        points: points.map((p) => ({ x: renderedRows(p.load), y: p.baseline })),
        errors: points.map((p) => whisker(p.load, p.baseline, p.baselineIqr)),
      },
    ];
    // Core-optimized only at loads whose comparison passed validation (line connects across dropped loads).
    const coreValidPoints = points.filter((p) => coreValidAt(report, p.load));
    if (coreValidPoints.length > 0) {
      series.push({
        name: 'Core-optimized',
        color: SERIES.coreOptimized,
        points: coreValidPoints.map((p) => ({ x: renderedRows(p.load), y: p.baselineOptimized })),
        errors: coreValidPoints.map((p) => whisker(p.load, p.baselineOptimized, p.baselineOptimizedIqr)),
      });
    }
    series.push({
      name: 'Boost',
      color: SERIES.boost,
      points: points.map((p) => ({ x: renderedRows(p.load), y: p.boost })),
      errors: points.map((p) => whisker(p.load, p.boost, p.boostIqr)),
    });
    return lineChart(options, series, theme);
  }

  const anchored = anchoredCore(result);
  const series: Series[] = [
    {
      name: 'Baseline',
      color: SERIES.baseline,
      points: loads.map((l) => ({ x: renderedRows(l), y: fpsAt(result, l, 'default', 'off') })),
    },
  ];
  if (anchored) {
    series.push({
      name: 'Core-optimized',
      color: SERIES.coreOptimized,
      points: anchored.map((p) => ({ x: renderedRows(p.load), y: p.baselineOptimized })),
    });
  }
  series.push({
    name: 'Boost',
    color: SERIES.boost,
    points: loads.map((l) => ({ x: renderedRows(l), y: fpsAt(result, l, 'default', 'on') })),
  });
  return lineChart(options, series, theme);
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

/** One platform's cross-version trend points for a gain metric, skipping runs whose metric is undefined. */
function trendPoints(
  ordered: RunResult[],
  platform: Platform,
  metric: (result: FpsResult) => number | undefined
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (let x = 0; x < ordered.length; x++) {
    const result = ordered[x].fps[platform];
    const gain = result ? metric(result) : undefined;
    if (gain !== undefined) points.push({ x, y: gain });
  }
  return points;
}

/** Cross-version convergence: per platform, Boost-vs-baseline (solid) and core-vs-baseline (dashed) FPS
 *  gain at each run's heaviest load, oldest→newest. The gap between the two lines is Boost's surviving
 *  margin; if the dashed line rises to meet the solid one, RN core is closing in. */
function trendChart(runs: RunResult[], theme: Theme): string | null {
  const ordered = [...runs].reverse(); // listRuns is newest-first
  if (ordered.length < 2) return null; // a one-point "trend" is noise
  const versions = ordered.map((r) => r.context.rnVersion);
  const series: Series[] = [];
  for (let index = 0; index < PLATFORMS.length; index++) {
    const platform = PLATFORMS[index];
    const color = seriesColor(index);
    const boost = trendPoints(ordered, platform, peakBoostGain);
    if (boost.length > 0) series.push({ name: `${PLATFORM_LABEL[platform]} · boost`, color, points: boost });
    const core = trendPoints(ordered, platform, peakCoreGain);
    if (core.length > 0) series.push({ name: `${PLATFORM_LABEL[platform]} · core`, color, points: core, dash: true });
  }
  if (series.length === 0) return null;
  const yMax = Math.max(10, ...series.flatMap((s) => s.points.map((p) => p.y))) * 1.15;
  return lineChart(
    {
      title: 'Boost vs core — FPS gain over baseline across React Native versions (heaviest load)',
      xLabel: 'React Native version',
      yLabel: 'FPS gain %',
      xTicks: versions.map((v, i) => ({ value: i, label: v })),
      yMax,
    },
    series,
    theme
  );
}

function fpsTableBaseline(result: FpsResult): string {
  const rows = loadsOf(result).map((load) => {
    const off = result.measurements.find((m) => m.load === load && m.boost === 'off');
    const on = result.measurements.find((m) => m.load === load && m.boost === 'on');
    const gain = off && on ? fmtPct(gainPct(off.avgFps, on.avgFps)) : '—';
    return `| ${renderedRows(load)} | ${off?.avgFps ?? '—'} | ${on?.avgFps ?? '—'} | ${gain} | ${off?.p95FrameMs ?? '—'} | ${on?.p95FrameMs ?? '—'} | ${off?.droppedPct ?? '—'}% → ${on?.droppedPct ?? '—'}% |`;
  });
  return [
    `### ${PLATFORM_LABEL[result.platform]} — ${result.device.name} (${result.device.kind}, ${PLATFORM_LABEL[result.platform]} ${result.device.osVersion}), ${MODE_LABEL[result.buildMode]}`,
    '',
    ...thermalNote(result),
    '| Text rows | Baseline FPS | Boost FPS | Gain | Baseline p95 ms | Boost p95 ms | Dropped |',
    '| ---: | ---: | ---: | ---: | ---: | ---: | :--- |',
    ...rows,
    '',
    chartPicture(`./graphs/fps-${result.platform}`, 'FPS @ load'),
    '',
  ].join('\n');
}

function fpsTableWithCore(result: FpsResult): string {
  const anchored = anchoredCore(result) ?? [];
  const rows = anchored.map((p) => {
    const coreGain = p.baseline === 0 ? '—' : fmtPct(gainPct(p.baseline, p.baselineOptimized));
    const boostGain = p.baseline === 0 ? '—' : fmtPct(gainPct(p.baseline, p.boost));
    const boostOverCore = p.baselineOptimized === 0 ? '—' : fmtPct(gainPct(p.baselineOptimized, p.boost));
    return `| ${renderedRows(p.load)} | ${round1(p.baseline)} | ${round1(p.baselineOptimized)} | ${round1(p.boost)} | ${coreGain} | ${boostGain} | ${boostOverCore} |`;
  });
  return [
    `### ${PLATFORM_LABEL[result.platform]} — ${result.device.name} (${result.device.kind}, ${PLATFORM_LABEL[result.platform]} ${result.device.osVersion}), ${MODE_LABEL[result.buildMode]}`,
    '',
    ...thermalNote(result),
    'Core-optimized FPS is anchored onto the baseline build via the flag-invariant Boost curve (§ anchor).',
    '',
    '| Text rows | Baseline FPS | Core-opt FPS | Boost FPS | Core gain | Boost gain | Boost margin over core |',
    '| ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows,
    '',
    chartPicture(`./graphs/fps-${result.platform}`, 'FPS @ load'),
    '',
  ].join('\n');
}

/** The per-load validation verdict as a report block: a ✓ note when every load passed, else a note that
 *  core is shown only where trustworthy, listing the dropped loads and why. */
function validationBlock(result: FpsResult): string[] {
  const report = validate(result);
  if (report.allValid) {
    return [
      '> **✓ Validated** — every load passed: captures at the thermal floor, the flag-invariant Boost curves ' +
        'agree, and replicate spread is tight. Core-optimized FPS is the **direct** median (no anchor); chart ' +
        'whiskers show the replicate IQR.',
      '',
    ];
  }
  const total = (convergencePoints(result) ?? []).length;
  const dropped = [...report.invalidLoads.entries()].sort((a, b) => a[0] - b[0]);
  return [
    `> **⚠ Core-optimized validated at ${total - dropped.length} of ${total} loads.** The core series is shown ` +
      `only where the comparison is trustworthy and dropped (\`—\`) where it isn’t; Boost-vs-baseline is valid ` +
      `throughout. Dropped:`,
    '',
    ...dropped.map(([load, reasons]) => `> - ${renderedRows(load)} rows: ${reasons.join('; ')}`),
    '',
  ];
}

/** Three-series table for a thermal run with direct gains at a common floor. The core column is shown
 *  per-load — dropped to `—` at loads whose comparison failed validation; Boost-vs-baseline shows always. */
function fpsTableValidated(result: FpsResult): string {
  const report = validate(result);
  const points = convergencePoints(result) ?? [];
  const rows = points.map((p) => {
    const valid = coreValidAt(report, p.load);
    const coreFps = valid ? round1(p.baselineOptimized) : '—';
    const coreGain = valid && p.baseline !== 0 ? fmtPct(gainPct(p.baseline, p.baselineOptimized)) : '—';
    const boostGain = p.baseline === 0 ? '—' : fmtPct(gainPct(p.baseline, p.boost));
    const boostOverCore = valid && p.baselineOptimized !== 0 ? fmtPct(gainPct(p.baselineOptimized, p.boost)) : '—';
    return `| ${renderedRows(p.load)} | ${round1(p.baseline)} | ${coreFps} | ${round1(p.boost)} | ${coreGain} | ${boostGain} | ${boostOverCore} |`;
  });
  return [
    `### ${PLATFORM_LABEL[result.platform]} — ${result.device.name} (${result.device.kind}, ${PLATFORM_LABEL[result.platform]} ${result.device.osVersion}), ${MODE_LABEL[result.buildMode]}`,
    '',
    ...thermalNote(result),
    ...validationBlock(result),
    '| Text rows | Baseline FPS | Core-opt FPS | Boost FPS | Core gain | Boost gain | Boost margin over core |',
    '| ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows,
    '',
    chartPicture(`./graphs/fps-${result.platform}`, 'FPS @ load'),
    '',
  ].join('\n');
}

const fpsTable = (result: FpsResult): string => {
  if (!isConvergence(result)) return fpsTableBaseline(result);
  return isThermalRun(result) ? fpsTableValidated(result) : fpsTableWithCore(result);
};

function fiberTable(fibers: FiberResult, hasCore: boolean): string {
  const rows = fibers.measurements.map(
    (m) =>
      `| ${renderedRows(m.load)} | ${m.off.fibers} | ${m.on.fibers} | ${m.saved.fibers} | ${fmtPct(reductionPct(m.off.fibers, m.on.fibers))} |`
  );
  // RN-core flags trim default props, not nodes, so the core profile's fiber count equals baseline's —
  // the structural saving stays Boost-only (FPS convergence ≠ structural convergence).
  const coreNote = hasCore
    ? [
        '',
        '> RN-core overhead-reduction flags trim default _props_, not tree _nodes_, so **baseline-optimized has the same fiber count as baseline** — the structural saving Boost makes is core-only by construction.',
      ]
    : [];
  return [
    `### Fiber savings — ${fibers.perRow.fibersOff} → ${fibers.perRow.fibersOn} nodes per row (saves ${fibers.perRow.savedPerRow})`,
    '',
    '| Text rows | Baseline nodes | Boost nodes | Saved | Reduction |',
    '| ---: | ---: | ---: | ---: | ---: |',
    ...rows,
    ...coreNote,
    '',
    chartPicture('./graphs/fibers', 'Tree nodes @ load'),
    '',
  ].join('\n');
}

function runMarkdown(run: RunResult): string {
  const { context } = run;
  const hasCore = runHasCore(run);
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
  // Thermal runs carry their verdict in the table's validation block; the anchor-divergence note is only
  // for legacy (pre-thermal) two-build runs.
  const warnings = PLATFORMS.flatMap((platform) => {
    const result = run.fps[platform];
    return result && !isThermalRun(result)
      ? anchorWarnings(result).map((w) => `${PLATFORM_LABEL[platform]} — ${w}`)
      : [];
  });
  if (warnings.length > 0) {
    lines.push(
      '> **⚠ Anchor divergence** — the baseline and core builds drifted past tolerance; the anchored core gain is suspect at:',
      '',
      ...warnings.map((w) => `> - ${w}`),
      ''
    );
  }
  if (run.fibers) {
    lines.push('## Fibers', '', fiberTable(run.fibers, hasCore));
  }
  return `${lines.join('\n')}\n`;
}

function archiveIndexMarkdown(runs: RunResult[], hasTrend: boolean): string {
  // A run with both profiles widens every gain cell to `boost / core`; with none it stays the original
  // single-number layout — so legacy archives render byte-for-byte as before the core profile existed.
  const anyCore = runs.some((run) => runHasCore(run));
  const fmtGain = (value: number | undefined): string => (value === undefined ? '—' : fmtPct(value));
  const cell = (result: FpsResult | undefined): string => {
    if (!result) return '—';
    const boost = fmtGain(peakBoostGain(result));
    // peakCoreGain returns the gain at the heaviest validated load (thermal) or anchored (legacy), or
    // undefined when no load is trustworthy → renders as `—`.
    return anyCore ? `${boost} / ${fmtGain(peakCoreGain(result))}` : boost;
  };
  const rows = runs.map((run) => {
    const dir = `results/rn-${run.context.rnVersion}/boost-${run.context.gitSha}`;
    const boost = `${run.context.boostVersion} (\`${run.context.gitSha}\`)`;
    return `| [${run.context.rnVersion}](./${dir}/report.md) | ${boost} | ${cell(run.fps.ios)} | ${cell(run.fps.android)} | ${run.fibers?.perRow.savedPerRow ?? '—'} |`;
  });
  const intro = anyCore
    ? [
        'Render-bound benchmark: a long, live-updating list whose rows are clusters of `Text` cells. Each',
        'gain cell is `boost / core` at the run’s heaviest load — Boost vs baseline, and RN core’s own',
        'overhead-reduction flags (`baseline-optimized`) vs baseline. The gap between them is how much of',
        'Boost’s Text-FPS advantage core has yet to replicate (`—` = the run predates the core profile).',
      ]
    : [
        'Render-bound benchmark: a long, live-updating list whose rows are clusters of `Text` cells. FPS gain is',
        'Boost vs baseline at each run’s heaviest load.',
      ];
  const gainHeader = anyCore ? 'iOS gain (boost / core) | Android gain (boost / core)' : 'iOS gain | Android gain';
  const trendAlt = anyCore
    ? 'Boost vs core FPS gain across React Native versions'
    : 'Boost FPS gain across React Native versions';
  return [
    '# React Native Boost — benchmark archive',
    '',
    ...intro,
    '',
    `| RN | Boost | ${gainHeader} | Saved nodes/row |`,
    '| --- | --- | ---: | ---: | ---: |',
    ...rows,
    '',
    ...(hasTrend ? [chartPicture('./graphs/trend', trendAlt), ''] : []),
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
