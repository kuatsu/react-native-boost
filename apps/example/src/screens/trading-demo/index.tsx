import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DebugPanel } from './components/debug-panel';
import { FpsOverlay } from './components/fps-overlay';
import { benchmarkCoin } from './model/coins';
import { createFeedController, FeedSnapshot, PriceDirection } from './model/feed';
import { formatPrice, formatSignedPercent } from './model/format';
import { initialLevels, loadForLevels, wallTickMs } from './model/presets';
import * as optimizedRows from './components/rows';
import { StatTone } from './components/rows';
import * as unoptimizedRows from './components/rows.unoptimized';

const hashString = (value: string): number => {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) % 2_147_483_647;
  }
  return hash;
};

const directionTone = (direction: PriceDirection): StatTone => {
  if (direction === 'up') return 'up';
  if (direction === 'down') return 'down';
  return 'neutral';
};

export default function TradingDemoScreen() {
  const quoteSymbol = benchmarkCoin.pair.split('/')[1] ?? 'USDT';

  const [controlsOpen, setControlsOpen] = useState(false);
  const [boost, setBoost] = useState(true);
  const [settledLevels, setSettledLevels] = useState(initialLevels);
  const loadRef = useRef(loadForLevels(initialLevels));

  const [controller] = useState(() =>
    createFeedController(benchmarkCoin, hashString(benchmarkCoin.symbol), loadForLevels(initialLevels))
  );
  const [snapshot, setSnapshot] = useState<FeedSnapshot>(() => controller.snapshot());

  useEffect(() => {
    const id = setInterval(() => {
      setSnapshot(controller.tick(loadRef.current));
    }, wallTickMs);
    return () => clearInterval(id);
  }, [controller]);

  const handleLevelsChange = (levels: number): void => {
    loadRef.current = loadForLevels(levels);
  };

  const handleLevelsCommit = (levels: number): void => {
    loadRef.current = loadForLevels(levels);
    setSettledLevels(levels);
  };

  const bestAsk = snapshot.asks[0]?.price ?? benchmarkCoin.price;
  const bestBid = snapshot.bids[0]?.price ?? benchmarkCoin.price;
  const spreadText = useMemo(
    () => formatPrice(Math.abs(bestAsk - bestBid), benchmarkCoin.priceDecimals),
    [bestAsk, bestBid]
  );

  const stats = useMemo(() => {
    const spread = Math.abs(benchmarkCoin.changePercent) / 200;
    return {
      changeText: formatSignedPercent(benchmarkCoin.changePercent),
      high: formatPrice(benchmarkCoin.price * (1 + spread + 0.012), benchmarkCoin.priceDecimals),
      low: formatPrice(benchmarkCoin.price * (1 - spread - 0.009), benchmarkCoin.priceDecimals),
    };
  }, []);

  const Stat = boost ? optimizedRows.HeaderStat : unoptimizedRows.HeaderStat;
  const Wall = boost ? optimizedRows.PriceWall : unoptimizedRows.PriceWall;

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <View style={styles.header}>
        <Stat label="Last Price" value={snapshot.lastPriceText} tone={directionTone(snapshot.lastDirection)} />
        <Stat label="24h Change" value={stats.changeText} tone={benchmarkCoin.changePercent >= 0 ? 'up' : 'down'} />
        <Stat label="24h High" value={stats.high} />
        <Stat label="24h Low" value={stats.low} />
      </View>

      <Wall
        asks={snapshot.asks}
        bids={snapshot.bids}
        lastPriceText={snapshot.lastPriceText}
        lastTone={directionTone(snapshot.lastDirection)}
        spreadText={spreadText}
        baseSymbol={benchmarkCoin.symbol}
        quoteSymbol={quoteSymbol}
      />

      {controlsOpen && <FpsOverlay />}

      <DebugPanel
        open={controlsOpen}
        onOpenChange={setControlsOpen}
        levels={settledLevels}
        onLevelsChange={handleLevelsChange}
        onLevelsCommit={handleLevelsCommit}
        boost={boost}
        onBoostChange={setBoost}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0b0e11',
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222831',
  },
});
