import { FeedConfig } from './feed';

// The order book renders `levels` price levels per side, each a 3-cell row
// (price/amount/total), so the churning Text-cell count is levels * 6.
export const minLevels = 34;
export const maxLevels = 300;
export const initialLevels = 160;

const minChurn = 0.1;
const maxChurn = 0.15;

export const wallTickMs = 16;

export const loadForLevels = (levels: number): FeedConfig => {
  const clamped = Math.max(minLevels, Math.min(maxLevels, Math.round(levels)));
  const progress = (clamped - minLevels) / (maxLevels - minLevels);
  return { levels: clamped, churn: minChurn + progress * (maxChurn - minChurn) };
};
