export interface Benchmark {
  title: string;
  count: number;
  optimizedComponent: React.ReactNode;
  unoptimizedComponent: React.ReactNode;
}

export enum BenchmarkStep {
  Unoptimized = 'unoptimized',
  Optimized = 'optimized',
}
