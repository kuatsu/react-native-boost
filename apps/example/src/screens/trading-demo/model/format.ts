const groupThousands = (value: string): string => {
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [integer, fraction] = unsigned.split('.');
  const grouped = integer.replaceAll(/\B(?=(\d{3})+(?!\d))/g, ',');
  const joined = fraction ? `${grouped}.${fraction}` : grouped;
  return negative ? `-${joined}` : joined;
};

export const formatPrice = (value: number, decimals: number): string => groupThousands(value.toFixed(decimals));

export const formatSize = (value: number): string => value.toFixed(4);

export const formatTotal = (value: number): string => groupThousands(value.toFixed(2));

export const formatSignedPercent = (value: number): string => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};
