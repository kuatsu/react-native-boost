export const ensureArray = <T>(value: T | T[]): T[] => {
  if (Array.isArray(value)) return value;
  return [value];
};

export type BailoutCheck = {
  reason: string;
  shouldBail: () => boolean;
};

export const getFirstBailoutReason = (checks: readonly BailoutCheck[]): string | null => {
  for (const check of checks) {
    if (check.shouldBail()) {
      return check.reason;
    }
  }

  return null;
};
