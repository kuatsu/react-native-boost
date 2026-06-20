import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { coins } from '../trading-demo/model/coins';
import { createFeedController, FeedSnapshot, PriceDirection } from '../trading-demo/model/feed';
import { formatPrice } from '../trading-demo/model/format';
import { loadForLevels } from '../trading-demo/model/presets';
import * as optimizedRows from '../trading-demo/components/rows';
import { StatTone } from '../trading-demo/components/rows';
import * as unoptimizedRows from '../trading-demo/components/rows.unoptimized';
import { getPlan, postDone, postMeasure } from './client';
import { summarize } from './fps';
import { BenchmarkPlan } from './protocol';

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

interface Step {
  boost: boolean;
  load: number;
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

    void (async () => {
      const steps: Step[] = plan.boostModes.flatMap((mode) =>
        plan.loads.map((load) => ({ boost: mode === 'on', load }))
      );
      for (let i = 0; i < steps.length && !cancelled; i++) {
        const current = steps[i];
        setStatus(`step ${i + 1}/${steps.length}: ${current.boost ? 'boost' : 'baseline'} @ ${current.load} levels`);
        setStep(current);
        await delay(plan.warmupMs);
        if (cancelled) return;
        const deltas = await capture(plan.captureMs);
        if (cancelled) return;
        // Don't let one failed post abort the sweep — surface it and keep going so the rest still lands.
        try {
          await postMeasure({
            load: current.load,
            boost: current.boost ? 'on' : 'off',
            ...summarize(deltas, plan.tickMs),
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
