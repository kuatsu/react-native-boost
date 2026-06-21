import { effectiveFlags } from '../../benchmark/feature-flags';
import { BenchmarkPlan, FpsMeasurement } from './protocol';

/**
 * The suite injects the server origin at build time via EXPO_PUBLIC_BENCHMARK_SERVER (host differs by
 * target: localhost for an iOS simulator, 10.0.2.2 for an Android emulator, the machine's LAN IP for a
 * physical device). Falls back to localhost so the screen is still usable when launched by hand.
 */
const SERVER = process.env.EXPO_PUBLIC_BENCHMARK_SERVER ?? 'http://localhost:8099';

export async function getPlan(): Promise<BenchmarkPlan> {
  // Echo the RN flags that actually took effect (after override), so the host can reject a launch where
  // the profile arg didn't arrive OR silently no-op'd — not just a stale bundle. The host compares this to
  // the profile it relaunched with before trusting the sweep.
  const flags = effectiveFlags.join(',');
  const response = await fetch(`${SERVER}/plan?flags=${encodeURIComponent(flags)}`);
  if (!response.ok) throw new Error(`plan request failed: ${response.status}`);
  return (await response.json()) as BenchmarkPlan;
}

export async function postMeasure(measurement: FpsMeasurement): Promise<void> {
  const response = await fetch(`${SERVER}/measure`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(measurement),
  });
  if (!response.ok) throw new Error(`measure post failed: ${response.status}`);
}

export async function postDone(): Promise<void> {
  const response = await fetch(`${SERVER}/done`, { method: 'POST' });
  if (!response.ok) throw new Error(`done post failed: ${response.status}`);
}
