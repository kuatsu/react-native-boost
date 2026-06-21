import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getThermalState } from 'react-native-time-to-render';
import { coins } from '../trading-demo/model/coins';
import { createFeedController, FeedSnapshot, PriceDirection } from '../trading-demo/model/feed';
import { formatPrice } from '../trading-demo/model/format';
import { loadForLevels } from '../trading-demo/model/presets';
import * as optimizedRows from '../trading-demo/components/rows';
import { StatTone } from '../trading-demo/components/rows';
import * as unoptimizedRows from '../trading-demo/components/rows.unoptimized';
import { getPlan, postDone, postMeasure } from './client';
import { summarize } from './fps';
import { BenchmarkPlan, BoostMode, ThermalLevel } from './protocol';

/**
 * Self-driving benchmark mode. Mounted instead of the normal app when EXPO_PUBLIC_BENCHMARK=1; it pulls
 * a sweep plan from the suite's HTTP server, then for each (Boost mode × load) renders the order-book
 * wall under a live feed, measures the JS-thread frame rate over a capture window, and posts the result
 * back. Boost on vs off is a real A/B: the optimized wall is transformed by the plugin, the `.unoptimized`
 * twin is excluded — same component tree, only the wrapper tax differs. Works in release builds (no UI
 * needed beyond a status banner).
 */

const coin = coins[0];
const quoteSymbol = coin.pair.split('/')[1] ?? 'USDT';
const seed = 1337;

const directionTone = (direction: PriceDirection): StatTone =>
  direction === 'up' ? 'up' : direction === 'down' ? 'down' : 'neutral';

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Heat ordering; 'serious' and an unreadable 'unknown' share the top non-critical rank so the cooldown
// gate errs toward waiting when the signal is hot or missing.
const levelRank = (level: ThermalLevel): number =>
  level === 'nominal' ? 0 : level === 'fair' ? 1 : level === 'critical' ? 3 : 2;

interface Step {
  boost: boolean;
  load: number;
  replicate: number;
}

// FPS within this margin of the detected refresh ceiling carries no signal → that load is "clamped".
const CLAMP_EPSILON = 2;

/** Deterministic Fisher–Yates using a Park–Miller (MINSTD) LCG so 'shuffle' is reproducible from the seed.
 *  Arithmetic-only (no bitwise ops); state·48271 stays under 2^53 so there's no precision loss. */
function seededShuffle(items: number[], seed: number): number[] {
  const result = [...items];
  let state = (Math.abs(Math.trunc(seed)) % 2_147_483_646) + 1;
  const next = (): number => {
    state = (state * 48_271) % 2_147_483_647;
    return (state - 1) / 2_147_483_646;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Load order for one replicate pass: palindrome alternates asc/desc, shuffle permutes by seed+pass. */
function passLoads(plan: BenchmarkPlan, replicate: number): number[] {
  if (plan.order === 'palindrome') return replicate % 2 === 0 ? plan.loads : [...plan.loads].reverse();
  if (plan.order === 'shuffle') return seededShuffle(plan.loads, plan.seed + replicate);
  return plan.loads;
}

/**
 * Replicate-major schedule: each pass covers every load once (in `passLoads` order), so a cell's
 * `replicates` samples land at different points in the sweep — averaging them cancels residual time/thermal
 * drift the cooldown gate didn't fully remove. Within a pass the off/on order is counterbalanced by
 * `(loadIndex + replicate)` parity, so neither mode is always measured first (the first capture after a
 * cooldown is the coolest).
 */
function buildSchedule(plan: BenchmarkPlan): Step[] {
  const steps: Step[] = [];
  for (let replicate = 0; replicate < plan.replicates; replicate++) {
    const loads = passLoads(plan, replicate);
    for (let loadIndex = 0; loadIndex < loads.length; loadIndex++) {
      const load = loads[loadIndex];
      const pair: BoostMode[] = (loadIndex + replicate) % 2 === 0 ? ['off', 'on'] : ['on', 'off'];
      for (const mode of pair) {
        if (plan.boostModes.includes(mode)) steps.push({ boost: mode === 'on', load, replicate });
      }
    }
  }
  return steps;
}

export default function BenchmarkRunner() {
  const [plan, setPlan] = useState<BenchmarkPlan | null>(null);
  const [status, setStatus] = useState('connecting to benchmark server…');
  const [step, setStep] = useState<Step | null>(null);
  const [snapshot, setSnapshot] = useState<FeedSnapshot | null>(null);

  const deltasRef = useRef<number[] | null>(null);
  const lastFrameRef = useRef<number | null>(null);

  // Persistent rAF loop: records inter-frame deltas only while a capture window is open.
  useEffect(() => {
    let handle = requestAnimationFrame(function loop(time: number): void {
      const previous = lastFrameRef.current;
      lastFrameRef.current = time;
      if (previous !== null && deltasRef.current !== null) deltasRef.current.push(time - previous);
      handle = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(handle);
  }, []);

  // Drive the order-book feed for the active step; a fresh controller + interval per step.
  useEffect(() => {
    if (!step || !plan) return;
    const config = loadForLevels(step.load);
    const controller = createFeedController(coin, seed, config);
    setSnapshot(controller.snapshot());
    const id = setInterval(() => setSnapshot(controller.tick(config)), plan.tickMs);
    return () => clearInterval(id);
  }, [step, plan]);

  // Pull the plan on boot.
  useEffect(() => {
    getPlan()
      .then(setPlan)
      .catch((error: Error) => setStatus(`error: ${error.message}`));
  }, []);

  // Run the sweep once the plan arrives.
  useEffect(() => {
    if (!plan) return;
    let cancelled = false;
    const capture = (ms: number): Promise<number[]> =>
      new Promise((resolve) => {
        deltasRef.current = [];
        lastFrameRef.current = null; // seed the baseline so the window's first frame isn't a phantom delta
        setTimeout(() => {
          const deltas = deltasRef.current ?? [];
          deltasRef.current = null;
          resolve(deltas);
        }, ms);
      });

    // Hold the device at the thermal floor before a capture: drop to the idle screen (no Wall, no feed
    // interval) so the heavy render stops heating, then poll until at/below the floor — or until the wait
    // budget runs out, in which case capture hot and let the host flag it. This is what makes captures
    // comparable across loads/boost/builds: every one is taken at ~the same temperature.
    const cooldown = (): Promise<ThermalLevel> =>
      new Promise((resolve) => {
        const floorRank = levelRank(plan.thermalFloor);
        setStep(null);
        const start = Date.now();
        const poll = (): void => {
          const level = getThermalState();
          if (cancelled || levelRank(level) <= floorRank || Date.now() - start >= plan.thermalMaxWaitMs) {
            resolve(level);
            return;
          }
          setStatus(`cooling: ${level} → waiting for ≤ ${plan.thermalFloor}`);
          setTimeout(poll, plan.thermalPollMs);
        };
        poll();
      });

    void (async () => {
      const steps = buildSchedule(plan);
      // Budget focus: spend replicates only where there's signal. Loads whose first-pass FPS pins within
      // CLAMP_EPSILON of the detected refresh ceiling are measured once; the rest get the full replicates.
      let ceiling = 0;
      const firstPassMin = new Map<number, number>();
      const isClamped = (load: number): boolean => {
        const min = firstPassMin.get(load);
        return min !== undefined && min >= ceiling - CLAMP_EPSILON;
      };
      for (let i = 0; i < steps.length && !cancelled; i++) {
        const current = steps[i];
        if (current.replicate > 0 && isClamped(current.load)) continue;
        const cooledTo = await cooldown();
        if (cancelled) return;
        setStatus(
          `step ${i + 1}/${steps.length}: ${current.boost ? 'boost' : 'baseline'} @ ${current.load} ` +
            `(rep ${current.replicate + 1}/${plan.replicates}, ≤${cooledTo})`
        );
        setStep(current);
        await delay(plan.warmupMs);
        if (cancelled) return;
        const thermalStart = getThermalState();
        const deltas = await capture(plan.captureMs);
        const thermalEnd = getThermalState();
        if (cancelled) return;
        const summary = summarize(deltas, plan.tickMs);
        ceiling = Math.max(ceiling, summary.avgFps);
        if (current.replicate === 0) {
          firstPassMin.set(
            current.load,
            Math.min(firstPassMin.get(current.load) ?? Number.POSITIVE_INFINITY, summary.avgFps)
          );
        }
        // Don't let one failed post abort the sweep — surface it and keep going so the rest still lands.
        try {
          await postMeasure({
            load: current.load,
            boost: current.boost ? 'on' : 'off',
            replicate: current.replicate,
            thermalStart,
            thermalEnd,
            ...summary,
          });
        } catch (error) {
          setStatus(`warn @ ${current.load}: ${(error as Error).message}`);
        }
      }
      if (cancelled) return;
      await postDone().catch(() => {}); // always release the host; it falls back to its timeout otherwise
      setStatus('done — all configs captured');
      setStep(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [plan]);

  const Wall = step?.boost ? optimizedRows.PriceWall : unoptimizedRows.PriceWall;
  const bestAsk = snapshot?.asks[0]?.price ?? coin.price;
  const bestBid = snapshot?.bids[0]?.price ?? coin.price;

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      {step && snapshot ? (
        <Wall
          asks={snapshot.asks}
          bids={snapshot.bids}
          lastPriceText={snapshot.lastPriceText}
          lastTone={directionTone(snapshot.lastDirection)}
          spreadText={formatPrice(Math.abs(bestAsk - bestBid), coin.priceDecimals)}
          baseSymbol={coin.symbol}
          quoteSymbol={quoteSymbol}
        />
      ) : null}
      <View style={styles.banner} pointerEvents="none">
        <Text style={styles.bannerText}>{status}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0b0e11',
  },
  banner: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(8, 11, 15, 0.9)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2a3139',
  },
  bannerText: {
    color: '#eaecef',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
