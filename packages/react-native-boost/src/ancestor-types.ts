export type AncestorClassification = 'safe' | 'text' | 'unknown';
export type ComponentAncestorClassification = AncestorClassification | 'transparent';

export type AncestorSummary =
  | ComponentAncestorClassification
  | { kind: 'import'; source: string; imported: string }
  | { kind: 'ancestors' | 'branches'; values: AncestorSummary[] };

export interface ModuleAncestorAnalysis {
  exports: Record<string, AncestorSummary>;
  exportAll: string[];
  references: Array<{ source: string; imported: string }>;
}

export interface AncestorSnapshot {
  version: 1;
  revision: number;
  platforms: Record<string, Record<string, Record<string, Record<string, ComponentAncestorClassification>>>>;
}
