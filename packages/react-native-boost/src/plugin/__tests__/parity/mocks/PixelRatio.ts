// Older StyleSheet modules read device density at import time.
export default {
  get: () => 2,
  roundToNearestPixel: (value: number) => Math.round(value * 2) / 2,
};
