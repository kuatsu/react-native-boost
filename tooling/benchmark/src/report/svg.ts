/**
 * Minimal, dependency-free SVG chart primitives. The suite commits graphs to the repo, so plain SVG
 * (text-diffable, no binary, no native deps) is the right format. Every chart renders in a dark and a
 * light theme so the committed graphs match whichever color scheme the reader's GitHub is set to.
 */

export type Theme = 'dark' | 'light';

/** Theme-dependent chrome: backdrop, gridlines, axis/label text. Series colors are theme-independent. */
interface ThemeColors {
  background: string;
  grid: string;
  axis: string;
  text: string;
  muted: string;
}

export const THEMES: Record<Theme, ThemeColors> = {
  dark: { background: '#0b0e11', grid: '#222831', axis: '#6c7480', text: '#eaecef', muted: '#9aa3ad' },
  light: { background: '#ffffff', grid: '#e3e6ea', axis: '#7a828c', text: '#1b1f24', muted: '#5c6470' },
};

/** Semantic series colors — saturated enough to read on either theme's backdrop. */
export const SERIES = { boost: '#0ecb81', baseline: '#f6465d', coreOptimized: '#f0b90b' } as const;

const SERIES_COLORS = ['#0ecb81', '#f0b90b', '#4a9eff', '#f6465d', '#b07cff', '#ff9f43'];

export const seriesColor = (index: number): string => SERIES_COLORS[index % SERIES_COLORS.length];

const escape = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

interface Point {
  x: number;
  y: number;
}

export interface Series {
  name: string;
  color: string;
  points: Point[];
  /** Render dashed (used to encode a second metric in the same platform color on the convergence trend). */
  dash?: boolean;
  /** Optional per-point error whiskers (replicate dispersion), in the same y units as `points`. */
  errors?: Array<{ x: number; lo: number; hi: number }>;
}

type LegendPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

interface ChartOptions {
  title: string;
  xLabel: string;
  yLabel: string;
  /** Tick labels along the x axis (one per category / sampled x). */
  xTicks: Array<{ value: number; label: string }>;
  yMax?: number;
  width?: number;
  height?: number;
  /** Where to anchor the legend (default 'top-right'). Place it in whichever corner the data leaves empty. */
  legendPosition?: LegendPosition;
}

const PAD = { left: 70, right: 24, top: 52, bottom: 64 };

interface Frame {
  width: number;
  height: number;
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
  xMin: number;
  xMax: number;
  yMax: number;
  sx: (x: number) => number;
  sy: (y: number) => number;
}

function frame(options: ChartOptions, series: Series[]): Frame {
  const width = options.width ?? 760;
  const height = options.height ?? 440;
  const xs = series.flatMap((s) => s.points.map((p) => p.x));
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMax = options.yMax ?? Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.y))) * 1.1;
  const plotLeft = PAD.left;
  const plotRight = width - PAD.right;
  const plotTop = PAD.top;
  const plotBottom = height - PAD.bottom;
  return {
    width,
    height,
    plotLeft,
    plotRight,
    plotTop,
    plotBottom,
    xMin,
    xMax,
    yMax,
    sx: (x) => (xMax === xMin ? plotLeft : plotLeft + ((x - xMin) / (xMax - xMin)) * (plotRight - plotLeft)),
    sy: (y) => plotBottom - (y / yMax) * (plotBottom - plotTop),
  };
}

function chrome(options: ChartOptions, f: Frame, c: ThemeColors): string {
  const yTickCount = 5;
  const parts: string[] = [
    `<rect x="0" y="0" width="${f.width}" height="${f.height}" fill="${c.background}"/>`,
    `<text x="${f.plotLeft}" y="30" fill="${c.text}" font-size="18" font-weight="700" font-family="system-ui,sans-serif">${escape(options.title)}</text>`,
  ];
  for (let i = 0; i <= yTickCount; i++) {
    const value = (f.yMax / yTickCount) * i;
    const y = f.sy(value);
    parts.push(
      `<line x1="${f.plotLeft}" y1="${y}" x2="${f.plotRight}" y2="${y}" stroke="${c.grid}" stroke-width="1"/>`
    );
    parts.push(
      `<text x="${f.plotLeft - 10}" y="${y + 4}" fill="${c.axis}" font-size="12" text-anchor="end" font-family="system-ui,sans-serif">${Math.round(value)}</text>`
    );
  }
  for (const tick of options.xTicks) {
    const x = f.sx(tick.value);
    parts.push(
      `<text x="${x}" y="${f.plotBottom + 22}" fill="${c.axis}" font-size="12" text-anchor="middle" font-family="system-ui,sans-serif">${escape(tick.label)}</text>`
    );
  }
  parts.push(
    `<text x="${(f.plotLeft + f.plotRight) / 2}" y="${f.height - 16}" fill="${c.muted}" font-size="13" text-anchor="middle" font-family="system-ui,sans-serif">${escape(options.xLabel)}</text>`
  );
  parts.push(
    `<text x="18" y="${(f.plotTop + f.plotBottom) / 2}" fill="${c.muted}" font-size="13" text-anchor="middle" font-family="system-ui,sans-serif" transform="rotate(-90 18 ${(f.plotTop + f.plotBottom) / 2})">${escape(options.yLabel)}</text>`
  );
  return parts.join('\n');
}

function legend(series: Series[], f: Frame, c: ThemeColors, position: LegendPosition): string {
  const onLeft = position === 'top-left' || position === 'bottom-left';
  const onBottom = position === 'bottom-left' || position === 'bottom-right';
  const x = onLeft ? f.plotLeft + 12 : f.plotRight - 150;
  const top = onBottom ? f.plotBottom - series.length * 20 - 2 : f.plotTop + 8;
  return series
    .map((s, i) => {
      const y = top + i * 20;
      const swatch = s.dash
        ? `<line x1="${x}" y1="${y - 3}" x2="${x + 12}" y2="${y - 3}" stroke="${s.color}" stroke-width="2.5" stroke-dasharray="4 3"/>`
        : `<rect x="${x}" y="${y - 9}" width="12" height="12" rx="2" fill="${s.color}"/>`;
      return (
        swatch +
        `<text x="${x + 18}" y="${y + 1}" fill="${c.text}" font-size="12" font-family="system-ui,sans-serif">${escape(s.name)}</text>`
      );
    })
    .join('\n');
}

function wrap(width: number, height: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n${body}\n</svg>\n`;
}

export function lineChart(options: ChartOptions, series: Series[], theme: Theme): string {
  const c = THEMES[theme];
  const f = frame(options, series);
  const lines = series
    .map((s) => {
      const points = s.points.map((p) => `${f.sx(p.x).toFixed(1)},${f.sy(p.y).toFixed(1)}`).join(' ');
      const dots = s.points
        .map((p) => `<circle cx="${f.sx(p.x).toFixed(1)}" cy="${f.sy(p.y).toFixed(1)}" r="3.5" fill="${s.color}"/>`)
        .join('');
      const whiskers = (s.errors ?? [])
        .map((e) => {
          const x = f.sx(e.x).toFixed(1);
          const yLo = f.sy(e.lo).toFixed(1);
          const yHi = f.sy(e.hi).toFixed(1);
          return (
            `<line x1="${x}" y1="${yLo}" x2="${x}" y2="${yHi}" stroke="${s.color}" stroke-width="1.5" opacity="0.45"/>` +
            `<line x1="${(Number(x) - 3).toFixed(1)}" y1="${yHi}" x2="${(Number(x) + 3).toFixed(1)}" y2="${yHi}" stroke="${s.color}" stroke-width="1.5" opacity="0.45"/>` +
            `<line x1="${(Number(x) - 3).toFixed(1)}" y1="${yLo}" x2="${(Number(x) + 3).toFixed(1)}" y2="${yLo}" stroke="${s.color}" stroke-width="1.5" opacity="0.45"/>`
          );
        })
        .join('');
      const dash = s.dash ? ' stroke-dasharray="6 4"' : '';
      return `${whiskers}<polyline points="${points}" fill="none" stroke="${s.color}" stroke-width="2.5"${dash}/>${dots}`;
    })
    .join('\n');
  return wrap(
    f.width,
    f.height,
    [chrome(options, f, c), lines, legend(series, f, c, options.legendPosition ?? 'top-right')].join('\n')
  );
}

export function barChart(options: ChartOptions, series: Series[], theme: Theme): string {
  const c = THEMES[theme];
  const f = frame(options, series);
  const categories = options.xTicks.length;
  const slot = (f.plotRight - f.plotLeft) / Math.max(1, categories);
  const groupWidth = slot * 0.7;
  const barWidth = groupWidth / Math.max(1, series.length);
  const bars: string[] = [];
  for (const [categoryIndex] of options.xTicks.entries()) {
    const center = f.plotLeft + slot * (categoryIndex + 0.5);
    for (const [seriesIndex, s] of series.entries()) {
      const point = s.points[categoryIndex];
      if (!point) continue;
      const x = center - groupWidth / 2 + seriesIndex * barWidth;
      const y = f.sy(point.y);
      bars.push(
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(barWidth * 0.9).toFixed(1)}" height="${(f.plotBottom - y).toFixed(1)}" fill="${s.color}" rx="2"/>`
      );
    }
  }
  return wrap(
    f.width,
    f.height,
    [chrome(options, f, c), bars.join('\n'), legend(series, f, c, options.legendPosition ?? 'top-right')].join('\n')
  );
}
