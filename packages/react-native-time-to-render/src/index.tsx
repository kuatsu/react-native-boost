import TimeToRender from './NativeTimeToRender';
export { default as TimeToRenderView } from './TimeToRenderNativeComponent';

export type ThermalLevel = 'nominal' | 'fair' | 'serious' | 'critical' | 'unknown';

export function startMarker(name: string, time: number): void {
  return TimeToRender.startMarker(name, time);
}

export function getThermalState(): ThermalLevel {
  return TimeToRender.getThermalState() as ThermalLevel;
}
