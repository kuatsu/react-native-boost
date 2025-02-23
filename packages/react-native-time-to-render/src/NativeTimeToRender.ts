/* eslint-disable unicorn/filename-case */
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  startMarker(name: string, time: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('TimeToRender');
