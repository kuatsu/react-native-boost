import { BenchmarkPlan, FpsMeasurement } from './protocol';

/**
 * The suite injects the server origin at build time via EXPO_PUBLIC_BENCHMARK_SERVER (host differs by
 * target: localhost for an iOS simulator, 10.0.2.2 for an Android emulator, the machine's LAN IP for a
 * physical device). Falls back to localhost so the screen is still usable when launched by hand.
 */
const SERVER = process.env.EXPO_PUBLIC_BENCHMARK_SERVER ?? 'http://localhost:8099';

export async function getPlan(): Promise<BenchmarkPlan> {
  // Echo the RN flags baked into this bundle so the host can detect a stale build running the wrong
  // profile (it asserts these match the profile it expects before trusting the sweep).
  const flags = process.env.EXPO_PUBLIC_BENCHMARK_RN_FLAGS ?? '';
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
