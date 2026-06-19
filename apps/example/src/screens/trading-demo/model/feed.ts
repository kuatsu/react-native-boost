import { Coin } from './coins';
import { formatPrice, formatSize, formatTotal } from './format';

export type OrderSide = 'ask' | 'bid';
export type PriceDirection = 'up' | 'down' | 'flat';

export interface OrderBookLevel {
  key: string;
  price: number;
  priceText: string;
  sizeText: string;
  totalText: string;
}

export interface FeedSnapshot {
  asks: OrderBookLevel[];
  bids: OrderBookLevel[];
  lastPriceText: string;
  lastDirection: PriceDirection;
}

export interface FeedConfig {
  levels: number;
  churn: number;
}

export interface FeedController {
  snapshot(): FeedSnapshot;
  tick(config: FeedConfig): FeedSnapshot;
}

const SEED_MODULUS = 2_147_483_647;
const SEED_MULTIPLIER = 16_807;

// The book churns every frame, but a real exchange ticker's last price moves a
// couple of times a second — advance it on a slower cadence (≈640ms at the 16ms
// tick) so the header reads realistically instead of strobing.
const ticksPerPriceStep = 40;

const createRandom = (seed: number): (() => number) => {
  let state = seed % SEED_MODULUS;
  if (state <= 0) state += SEED_MODULUS - 1;
  return () => {
    state = (state * SEED_MULTIPLIER) % SEED_MODULUS;
    return (state - 1) / (SEED_MODULUS - 1);
  };
};

export const createFeedController = (coin: Coin, seed: number, initialConfig: FeedConfig): FeedController => {
  const random = createRandom(seed);
  const base = coin.price;

  let asks: OrderBookLevel[] = [];
  let bids: OrderBookLevel[] = [];
  let askCursor = 0;
  let bidCursor = 0;
  let levelCount = 0;
  let lastPrice = base;
  let previousLastPrice = base;
  let tickCount = 0;

  const randomSize = (): number => coin.sizeCeiling * (0.04 + random() * 0.96);

  const makeLevel = (side: OrderSide, index: number, price: number, size: number): OrderBookLevel => ({
    key: `${side}-${index}`,
    price,
    priceText: formatPrice(price, coin.priceDecimals),
    sizeText: formatSize(size),
    totalText: formatTotal(price * size),
  });

  const priceForLevel = (side: OrderSide, index: number): number =>
    side === 'ask' ? base + (index + 1) * coin.tickSize : base - (index + 1) * coin.tickSize;

  const buildLadder = (side: OrderSide, count: number): OrderBookLevel[] => {
    const ladder: OrderBookLevel[] = [];
    for (let index = 0; index < count; index++) {
      ladder.push(makeLevel(side, index, priceForLevel(side, index), randomSize()));
    }
    return ladder;
  };

  const churnLadder = (
    ladder: OrderBookLevel[],
    side: OrderSide,
    count: number,
    cursor: number
  ): { next: OrderBookLevel[]; cursor: number } => {
    if (count <= 0) return { next: ladder, cursor };

    const next = [...ladder];
    let position = cursor;
    for (let step = 0; step < count; step++) {
      const index = position % ladder.length;
      next[index] = makeLevel(side, index, ladder[index].price, randomSize());
      position++;
    }
    return { next, cursor: position % ladder.length };
  };

  const stepLastPrice = (): void => {
    const drift = (random() - 0.5) * coin.tickSize * 2;
    previousLastPrice = lastPrice;
    lastPrice = Math.max(coin.tickSize, lastPrice + drift);
  };

  const lastDirection = (): PriceDirection => {
    if (lastPrice > previousLastPrice) return 'up';
    if (lastPrice < previousLastPrice) return 'down';
    return 'flat';
  };

  const buildSnapshot = (): FeedSnapshot => ({
    asks,
    bids,
    lastPriceText: formatPrice(lastPrice, coin.priceDecimals),
    lastDirection: lastDirection(),
  });

  const rebuild = (levels: number): void => {
    levelCount = levels;
    askCursor = 0;
    bidCursor = 0;
    asks = buildLadder('ask', levels);
    bids = buildLadder('bid', levels);
  };

  rebuild(initialConfig.levels);

  return {
    snapshot: buildSnapshot,
    tick: (config: FeedConfig): FeedSnapshot => {
      if (config.levels === levelCount) {
        const count = Math.min(levelCount, Math.round(config.churn * levelCount));
        const churnedAsks = churnLadder(asks, 'ask', count, askCursor);
        const churnedBids = churnLadder(bids, 'bid', count, bidCursor);
        asks = churnedAsks.next;
        bids = churnedBids.next;
        askCursor = churnedAsks.cursor;
        bidCursor = churnedBids.cursor;
      } else {
        rebuild(config.levels);
      }
      tickCount++;
      if (tickCount % ticksPerPriceStep === 0) {
        stepLastPrice();
      }
      return buildSnapshot();
    },
  };
};
