import TimeToRender from './native-time-to-render';
export { default as TimeToRenderView } from './time-to-render-native-component';

export type ThermalLevel = 'nominal' | 'fair' | 'serious' | 'critical' | 'unknown';

export function startMarker(name: string, time: number): void {
  return TimeToRender.startMarker(name, time);
}

export function getThermalState(): ThermalLevel {
  return TimeToRender.getThermalState() as ThermalLevel;
}
