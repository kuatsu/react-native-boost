import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type {
  AncestorSnapshot,
  AncestorSummary,
  ComponentAncestorClassification,
  ModuleAncestorAnalysis,
} from '../ancestor-types';

const patchProperty = '__reactNativeBoostGraphPatch';
const requireFromGraph = createRequire(import.meta.url);

type OutputMetadata = { injectionId: string; analysis: ModuleAncestorAnalysis };
type MetroDependency = { absolutePath?: string; data: { name: string } };
type MetroModule = {
  dependencies: Map<string, MetroDependency>;
  output: Array<{ data: { reactNativeBoost?: OutputMetadata } }>;
  unstable_transformResultKey?: string;
};
type MetroDelta = { added: Map<string, MetroModule>; deleted: Set<string>; modified: Map<string, MetroModule> };
type MetroGraph = {
  dependencies: Map<string, MetroModule>;
  transformOptions?: { platform?: string };
};
type Traverse = (this: MetroGraph, paths: string[], options: unknown) => Promise<MetroDelta>;
type InitialTraverse = (this: MetroGraph, options: unknown) => Promise<MetroDelta>;
type ConsumerImports = Record<string, Record<string, Record<string, ComponentAncestorClassification>>>;

type ResolvedGraph = {
  consumers: ConsumerImports;
  values: Map<string, string>;
};

type Adapter = {
  injectionId: string;
  queue: Promise<void>;
  revision: number;
  snapshotPath: string;
  platforms: AncestorSnapshot['platforms'];
};

type Patch = {
  adapters: Adapter[];
  graphs: WeakMap<MetroGraph, { adapter: Adapter; resolved: ResolvedGraph }>;
  initial: InitialTraverse;
  traverse: Traverse;
};

type GraphConstructor = {
  prototype: { initialTraverseDependencies: InitialTraverse; traverseDependencies: Traverse };
  [patchProperty]?: Patch;
};

export function installMetroGraphPatch(
  graphPath: string,
  options: { injectionId: string; snapshotPath: string }
): void {
  const loaded = requireFromGraph(graphPath) as { Graph?: GraphConstructor; default?: GraphConstructor };
  const Graph = loaded.Graph ?? loaded.default;
  if (!Graph?.prototype?.initialTraverseDependencies || !Graph.prototype.traverseDependencies) {
    throw new Error('[react-native-boost] This Metro Graph implementation is not supported.');
  }

  let patch = Graph[patchProperty];
  if (!patch) {
    patch = {
      adapters: [],
      graphs: new WeakMap(),
      initial: Graph.prototype.initialTraverseDependencies,
      traverse: Graph.prototype.traverseDependencies,
    };
    Graph[patchProperty] = patch;
    Graph.prototype.initialTraverseDependencies = patchedInitialTraverse;
    Graph.prototype.traverseDependencies = patchedTraverse;
  }

  if (patch.adapters.some((adapter) => adapter.injectionId === options.injectionId)) return;
  patch.adapters.push({ ...options, queue: Promise.resolve(), revision: 0, platforms: {} });

  async function patchedInitialTraverse(this: MetroGraph, transformOptions: unknown): Promise<MetroDelta> {
    const activePatch = Graph![patchProperty]!;
    const result = await activePatch.initial.call(this, transformOptions);
    await updateAncestors(activePatch, this, result, transformOptions);
    return { ...result, added: this.dependencies };
  }

  async function patchedTraverse(
    this: MetroGraph,
    changedPaths: string[],
    transformOptions: unknown
  ): Promise<MetroDelta> {
    const activePatch = Graph![patchProperty]!;
    const result = await activePatch.traverse.call(this, changedPaths, transformOptions);
    return updateAncestors(activePatch, this, result, transformOptions);
  }
}

async function updateAncestors(
  patch: Patch,
  graph: MetroGraph,
  result: MetroDelta,
  transformOptions: unknown
): Promise<MetroDelta> {
  const adapter = patch.graphs.get(graph)?.adapter ?? findAdapter(patch.adapters, graph);
  if (!adapter) return result;

  return runExclusive(adapter, async () => {
    let previous = patch.graphs.get(graph)?.resolved;
    const changed = new Set([...result.added.keys(), ...result.modified.keys()]);

    while (true) {
      const resolved = resolveGraph(graph, adapter.injectionId);
      writeSnapshot(adapter, graph.transformOptions?.platform, resolved.consumers);
      const consumers = [...resolved.values]
        .filter(([consumer, value]) => changed.has(consumer) || previous?.values.get(consumer) !== value)
        .map(([consumer]) => consumer);
      if (consumers.length === 0) {
        patch.graphs.set(graph, { adapter, resolved });
        return result;
      }

      markTransformResultsStale(graph, consumers, adapter.revision);
      const next = await patch.traverse.call(graph, consumers, transformOptions);
      result = mergeDeltas(graph, result, next);
      previous = resolved;
      changed.clear();
    }
  });
}

export function resolveGraph(graph: MetroGraph, injectionId: string): ResolvedGraph {
  const consumers: ConsumerImports = {};
  const values = new Map<string, string>();

  for (const [consumerPath, module] of graph.dependencies) {
    const analysis = getAnalysis(module, injectionId);
    if (!analysis || analysis.references.length === 0) continue;

    const imports = Object.create(null) as ConsumerImports[string];
    for (const reference of analysis.references) {
      (imports[reference.source] ??= {})[reference.imported] = resolveImport(
        graph,
        consumerPath,
        reference.source,
        reference.imported,
        injectionId,
        new Set()
      );
    }
    consumers[consumerPath] = imports;
    values.set(consumerPath, JSON.stringify(imports));
  }

  return { consumers, values };
}

function resolveImport(
  graph: MetroGraph,
  modulePath: string,
  source: string,
  imported: string,
  injectionId: string,
  visiting: Set<string>
): ComponentAncestorClassification {
  const targetPath = findDependency(graph.dependencies.get(modulePath), source);
  return targetPath ? resolveExport(graph, targetPath, imported, injectionId, visiting).value : 'unknown';
}

function resolveExport(
  graph: MetroGraph,
  modulePath: string,
  exported: string,
  injectionId: string,
  visiting: Set<string>
): { found: boolean; value: ComponentAncestorClassification } {
  const key = `${modulePath}\0${exported}`;
  if (visiting.has(key)) return { found: true, value: 'unknown' };

  const analysis = getAnalysis(graph.dependencies.get(modulePath), injectionId);
  if (!analysis) return { found: false, value: 'unknown' };
  visiting.add(key);
  const summary = analysis.exports[exported];
  if (summary) {
    const value = evaluateSummary(graph, modulePath, summary, injectionId, visiting);
    visiting.delete(key);
    return { found: true, value };
  }
  if (exported === 'default') {
    visiting.delete(key);
    return { found: false, value: 'unknown' };
  }

  const matches = analysis.exportAll
    .map((source) => {
      const targetPath = findDependency(graph.dependencies.get(modulePath), source);
      return targetPath
        ? resolveExport(graph, targetPath, exported, injectionId, visiting)
        : { found: false, value: 'unknown' as const };
    })
    .filter((result) => result.found);
  visiting.delete(key);
  return matches.length === 1 ? matches[0]! : { found: matches.length > 0, value: 'unknown' };
}

function evaluateSummary(
  graph: MetroGraph,
  modulePath: string,
  summary: AncestorSummary,
  injectionId: string,
  visiting: Set<string>
): ComponentAncestorClassification {
  if (typeof summary === 'string') return summary;
  if (summary.kind === 'import') {
    return resolveImport(graph, modulePath, summary.source, summary.imported, injectionId, visiting);
  }

  const values = summary.values.map((value) => evaluateSummary(graph, modulePath, value, injectionId, visiting));
  if (summary.kind === 'ancestors') return values.find((value) => value !== 'transparent') ?? 'transparent';
  if (values.includes('text')) return 'text';
  return values.every((value) => value === values[0]) ? values[0]! : 'unknown';
}

function findDependency(module: MetroModule | undefined, source: string): string | undefined {
  let resolved: string | undefined;
  for (const dependency of module?.dependencies.values() ?? []) {
    if (dependency.data.name !== source || !dependency.absolutePath) continue;
    if (resolved && resolved !== dependency.absolutePath) return;
    resolved = dependency.absolutePath;
  }
  return resolved;
}

function getAnalysis(module: MetroModule | undefined, injectionId: string): ModuleAncestorAnalysis | undefined {
  for (const output of module?.output ?? []) {
    const metadata = output.data.reactNativeBoost;
    if (metadata?.injectionId === injectionId) return metadata.analysis;
  }
}

function findAdapter(adapters: Adapter[], graph: MetroGraph): Adapter | undefined {
  return adapters.find((adapter) =>
    [...graph.dependencies.values()].some((module) => getAnalysis(module, adapter.injectionId))
  );
}

// ponytail: serialize passes per project; use graph-specific worker inputs if concurrent builds become slow.
function runExclusive<T>(adapter: Adapter, operation: () => Promise<T>): Promise<T> {
  const result = adapter.queue.then(operation);
  adapter.queue = result.then(
    () => {},
    () => {}
  );
  return result;
}

function writeSnapshot(adapter: Adapter, platform: string | undefined, consumers: ConsumerImports): void {
  adapter.platforms[platform ?? ''] = consumers;
  const snapshot: AncestorSnapshot = {
    version: 1,
    revision: ++adapter.revision,
    platforms: adapter.platforms,
  };
  const temporaryPath = `${adapter.snapshotPath}.${process.pid}.${adapter.revision}`;
  fs.mkdirSync(path.dirname(adapter.snapshotPath), { recursive: true });
  fs.writeFileSync(temporaryPath, JSON.stringify(snapshot));
  fs.renameSync(temporaryPath, adapter.snapshotPath);
}

function markTransformResultsStale(graph: MetroGraph, consumers: string[], revision: number): void {
  for (const consumer of consumers) {
    const module = graph.dependencies.get(consumer);
    if (module) module.unstable_transformResultKey = `${module.unstable_transformResultKey ?? ''}.boost.${revision}`;
  }
}

function mergeDeltas(graph: MetroGraph, first: MetroDelta, second: MetroDelta): MetroDelta {
  const added = new Map(first.added);
  const modified = new Map(first.modified);
  const deleted = new Set([...first.deleted, ...second.deleted]);

  for (const path of second.added.keys()) {
    added.set(path, graph.dependencies.get(path)!);
    modified.delete(path);
    deleted.delete(path);
  }
  for (const path of second.modified.keys()) {
    const module = graph.dependencies.get(path)!;
    if (added.has(path)) added.set(path, module);
    else modified.set(path, module);
    deleted.delete(path);
  }
  for (const path of deleted) {
    added.delete(path);
    modified.delete(path);
  }
  return { added, deleted, modified };
}
