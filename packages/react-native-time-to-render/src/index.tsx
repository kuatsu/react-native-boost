import TimeToRender from './NativeTimeToRender';
export { default as TimeToRenderView } from './TimeToRenderNativeComponent';

export function startMarker(name: string, time: number): void {
  return TimeToRender.startMarker(name, time);
}
