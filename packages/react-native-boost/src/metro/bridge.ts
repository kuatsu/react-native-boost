import type { ModuleAncestorAnalysis } from '../ancestor-types';

const bridgeKey = Symbol.for('react-native-boost.transform-analysis');

type Bridge = Map<string, { injectionId: string; analysis: ModuleAncestorAnalysis }>;

function getBridge(): Bridge {
  const global = globalThis as typeof globalThis & { [bridgeKey]?: Bridge };
  return (global[bridgeKey] ??= new Map());
}

export function publishAnalysis(filename: string, metadata: { injectionId?: unknown; analysis?: unknown }): void {
  if (typeof metadata.injectionId !== 'string' || !metadata.analysis) return;
  getBridge().set(filename, {
    injectionId: metadata.injectionId,
    analysis: metadata.analysis as ModuleAncestorAnalysis,
  });
}

export function takeAnalysis(filename: string): { injectionId: string; analysis: ModuleAncestorAnalysis } | undefined {
  const bridge = getBridge();
  const analysis = bridge.get(filename);
  bridge.delete(filename);
  return analysis;
}
