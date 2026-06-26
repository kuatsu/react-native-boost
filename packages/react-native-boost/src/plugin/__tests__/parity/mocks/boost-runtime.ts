import { NativeTextCapturer, NativeViewCapturer } from '../capture';

/**
 * Stand-in for `react-native-boost/runtime`, used only by the fibers collector (redirected while
 * BENCH_FIBERS_OUT is set). The native components become the shared host capturers so the Boost output
 * renders and is countable without pulling the real runtime's untranspiled sources, and the prop
 * helpers are identity passthroughs — their return value doesn't affect the node/host counts measured.
 */
export const NativeText = NativeTextCapturer;
export const NativeView = NativeViewCapturer;
export const NativeImage = NativeViewCapturer;

export const processTextStyle = (style: unknown): Record<string, unknown> => (style ? { style } : {});
export const processViewStyle = (style: unknown): Record<string, unknown> => (style ? { style } : {});
export const processAccessibilityProps = (props: Record<string, unknown>): Record<string, unknown> => props;
export const processImageAccessibilityProps = (props: Record<string, unknown>): Record<string, unknown> => props;
