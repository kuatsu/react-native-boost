import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/** One native host render: which host kind, and the exact prop bag it received (children stripped). */
export interface Capture {
  which: string;
  props: Record<string, unknown>;
}

/**
 * Every native host capturer appends here, in render order (an outer host before its children), so a
 * nested render — e.g. a `NativeVirtualText` inside a `NativeText` — records each host distinctly
 * instead of overwriting a single slot. {@link renderAndCaptureAll} resets it before every render.
 */
export const captures: Capture[] = [];

/**
 * Builds a prop-recording function component standing in for a native host. It appends the exact prop
 * bag it receives to {@link captures} and renders its children so nested hosts are captured too.
 *
 * It must be a function component, not a host string token (e.g. `'RCTText'`): the DOM serializer
 * would lowercase attribute names and stringify values, destroying the fidelity we compare on.
 */
const makeCapturer =
  (which: string): React.FC<Record<string, unknown>> =>
  (props) => {
    captures.push({ which, props });
    return (props.children as React.ReactNode) ?? null;
  };

export const NativeTextCapturer = makeCapturer('NativeText');
export const NativeVirtualTextCapturer = makeCapturer('NativeVirtualText');
export const NativeViewCapturer = makeCapturer('NativeView');
export const NativeImageCapturer = makeCapturer('NativeImage');
export const TextInlineImageCapturer = makeCapturer('TextInlineImage');

/** Render an element and return every native host it produced, in render order. */
export function renderAndCaptureAll(element: React.ReactElement): Capture[] {
  captures.length = 0;
  renderToStaticMarkup(element);
  return captures.map(({ which, props }) => {
    const { children: _children, ...rest } = props;
    return { which, props: rest };
  });
}

/**
 * Render an element expected to produce exactly one native host and return it. Throws on any other
 * count so an unexpected extra/missing host surfaces loudly instead of silently comparing the wrong bag.
 */
export function renderAndCaptureSingle(element: React.ReactElement): Capture {
  const all = renderAndCaptureAll(element);
  if (all.length !== 1) {
    throw new Error(
      `Expected exactly one native host, captured ${all.length}: [${all.map((c) => c.which).join(', ')}]`
    );
  }
  return all[0];
}
