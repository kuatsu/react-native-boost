export interface Coin {
  symbol: string;
  pair: string;
  price: number;
  priceDecimals: number;
  tickSize: number;
  sizeCeiling: number;
  changePercent: number;
}

export const benchmarkCoin: Coin = {
  symbol: 'BTC',
  pair: 'BTC/USDT',
  price: 65_774,
  priceDecimals: 2,
  tickSize: 1,
  sizeCeiling: 6,
  changePercent: -0.14,
};
