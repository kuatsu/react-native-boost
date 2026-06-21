import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  startMarker(name: string, time: number): void;
  /** Current device thermal state: 'nominal' | 'fair' | 'serious' | 'critical' | 'unknown'. Synchronous
   *  (non-Promise return) so the benchmark runner can read it inline while gating captures. */
  getThermalState(): string;
  /** The `--rn-flags=` launch argument (iOS) / `rnFlags` intent extra (Android), or '' when absent.
   *  Lets the benchmark pick its build profile at launch instead of baking it; read synchronously before
   *  RN's Text module evaluates (see apps/example/src/benchmark/feature-flags.ts). */
  getForcedFlags(): string;
}

export default TurboModuleRegistry.getEnforcing<Spec>('TimeToRender');
