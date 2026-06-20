import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { transformSync, type TransformCaller } from '@babel/core';
import * as React from 'react';
import { expect, test } from 'vitest';
import boostPlugin from '../../index';
import { renderAndCaptureAll } from './capture';
import { setPlatformOS } from './mocks/Platform';

/**
 * Deterministic, device-free structural metric: how many React tree nodes (≈ fibers) Boost removes from
 * the order-book wall's churning rows. It renders one representative row both ways through the parity
 * harness's real-RN pipeline and counts every render-time `jsx()` call (the parity config redirects
 * `react/jsx-runtime` to a counting wrapper while BENCH_FIBERS_OUT is set, so the nodes the RN `Text`
 * wrappers create internally are tallied; the Boost output's native hosts are redirected to capturers).
 *
 * The row mirrors the actual wall (`trading-demo/components/rows.tsx`): a `Fragment` of three `Text`
 * cells — no per-row `View` (the wall's Views are fixed, not per-row) — and the Boost variant carries
 * the same `@boost-force` the wall uses (a `Text` under a `.map`/`Fragment` has an unprovable ancestor
 * and bails otherwise). Both sides are measured, not assumed. Runs only when BENCH_FIBERS_OUT is set.
 */

const counters = globalThis as { __JSX_COUNT__?: number };
let counter = 0;

/** Three price/amount/total cells; `force` carries `@boost-force` on the Boost variant. */
const cells = (force: string): string =>
  ['price', 'amount', 'total']
    .map((text, index) => `${force}<Text style={s[${index}]} numberOfLines={1}>${text}</Text>`)
    .join('');

// Boost OFF: the real RN `Text` wrapper (deep import, resolved + transformed by the parity pipeline).
const WRAPPER_SOURCE =
  `import Text from 'react-native/Libraries/Text/Text';\n` +
  `const s = [{}, {}, {}];\n` +
  `export default function Row(){ return <>${cells('')}</>; }`;
// Boost ON: bare import + `@boost-force` (as the wall has), which the plugin rewrites to native hosts.
const BOOST_SOURCE =
  `import { Text } from 'react-native';\n` +
  `const s = [{}, {}, {}];\n` +
  `export default function Row(){ return <>${cells('{/* @boost-force */}')}</>; }`;

async function compile(source: string, tag: string, boost: boolean): Promise<React.ComponentType> {
  const out = transformSync(source, {
    configFile: false,
    babelrc: false,
    filename: `${tag}.jsx`,
    caller: { name: 'metro', platform: 'ios' } as TransformCaller,
    presets: [['@babel/preset-react', { runtime: 'automatic' }]],
    plugins: boost ? [[boostPlugin, { silent: true }]] : [],
  });
  const file = fileURLToPath(new URL(`./__generated__/fibers-${tag}-${counter++}.js`, import.meta.url));
  writeFileSync(file, out!.code!);
  return (await import(/* @vite-ignore */ file)).default;
}

/** Render once; count rendered nodes (jsx calls + the root element) and native hosts. */
function measure(Row: React.ComponentType): { fibers: number; hosts: number } {
  counters.__JSX_COUNT__ = 0;
  const hosts = renderAndCaptureAll(React.createElement(Row)); // resets the capture buffer, then renders
  // +1 for the root element, created via React.createElement (not via the counted jsx runtime).
  return { fibers: (counters.__JSX_COUNT__ ?? 0) + 1, hosts: hosts.length };
}

test.skipIf(!process.env.BENCH_FIBERS_OUT)('fibers: Boost removes wrapper nodes', async () => {
  setPlatformOS('ios');
  const off = await compile(WRAPPER_SOURCE, 'wrapper', false).then(measure);
  const on = await compile(BOOST_SOURCE, 'boost', true).then(measure);

  // Boost keeps the same native hosts but removes the wrapper composites around them.
  expect(on.hosts).toBe(off.hosts);
  expect(off.fibers).toBeGreaterThan(on.fibers);

  const savedPerRow = off.fibers - on.fibers;
  const loads: number[] = JSON.parse(process.env.BENCH_FIBERS_LOADS ?? '[34,100,160,230,300]');
  const measurements = loads.map((load) => {
    const rows = 2 * load; // `load` ask rows + `load` bid rows, each a three-cell row
    return {
      load,
      on: { fibers: on.fibers * rows, hosts: on.hosts * rows },
      off: { fibers: off.fibers * rows, hosts: off.hosts * rows },
      saved: { fibers: savedPerRow * rows, hosts: 0 },
    };
  });

  writeFileSync(
    process.env.BENCH_FIBERS_OUT!,
    `${JSON.stringify({ measurements, perRow: { fibersOn: on.fibers, fibersOff: off.fibers, savedPerRow } }, null, 2)}\n`
  );
});
