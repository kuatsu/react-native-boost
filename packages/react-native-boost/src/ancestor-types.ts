/** `context` means child handling is known, but Text context varies between branches. */
export type AncestorClassification = 'safe' | 'text' | 'context' | 'unknown';
export type ComponentAncestorClassification = AncestorClassification | 'transparent';

export type AncestorSummary =
  | ComponentAncestorClassification
  | { kind: 'import'; source: string; imported: string }
  | { kind: 'ancestors' | 'branches'; values: AncestorSummary[] };

export interface ModuleAncestorAnalysis {
  exports: Record<string, AncestorSummary>;
  exportAll: string[];
  /** The values used by Babel let Metro skip transforms whose ancestor inputs did not change. */
  references: Array<{ source: string; imported: string; classification: ComponentAncestorClassification }>;
}

export interface AncestorSnapshot {
  version: 1;
  revision: number;
  platforms: Record<string, Record<string, Record<string, Record<string, ComponentAncestorClassification>>>>;
}
