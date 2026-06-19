import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * The single shared sink both the wrapper and Boost sides funnel their native props into. Whichever
 * native host capturer renders last writes here, so {@link renderAndCapture} resets it before every
 * render and reads it immediately after.
 */
interface Sink {
  props?: Record<string, unknown>;
  which?: string;
}

export const sink: Sink = {};

/**
 * Builds a prop-recording function component standing in for a native host. It records the exact
 * prop bag it receives into the shared {@link sink} and renders its children so nested hosts (e.g.
 * a `NativeVirtualText` inside a `NativeText`) are captured too.
 *
 * It must be a function component, not a host string token (e.g. `'RCTText'`): the DOM serializer
 * would lowercase attribute names and stringify values, destroying the fidelity we compare on.
 */
const makeCapturer =
  (which: string): React.FC<Record<string, unknown>> =>
  (props) => {
    sink.props = props;
    sink.which = which;
    return (props.children as React.ReactNode) ?? null;
  };

export const NativeTextCapturer = makeCapturer('NativeText');
export const NativeVirtualTextCapturer = makeCapturer('NativeVirtualText');
export const NativeViewCapturer = makeCapturer('NativeView');

/** Render an element and return the props its single native host received (children stripped). */
export function renderAndCapture(element: React.ReactElement): { which?: string; props: Record<string, unknown> } {
  sink.props = undefined;
  sink.which = undefined;
  renderToStaticMarkup(element);
  const captured: Record<string, unknown> = sink.props ?? {};
  const { children: _children, ...rest } = captured;
  return { which: sink.which, props: rest };
}
