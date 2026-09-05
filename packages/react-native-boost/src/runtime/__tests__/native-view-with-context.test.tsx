import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { URL } from 'node:url';
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { use } from 'react';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { unstable_TextAncestorContext as TextAncestorContext } from 'react-native';
import { afterEach, expect, it, vi } from 'vitest';
import { NativeViewWithContext } from '../components/native-view-with-context';
import { NativeView } from '../components/native-view';

const captures = vi.hoisted(() => [] as Array<{ props: Record<string, unknown>; context: boolean }>);

vi.mock('react-native', async () => {
  const { createContext } = await import('react');
  return { View: () => null, unstable_TextAncestorContext: createContext(false) };
});
vi.mock('../components/native-view', () => ({
  NativeView: (props: Record<string, unknown>) => {
    captures.push({ props, context: use(TextAncestorContext) });
    return props.children as ReactNode;
  },
}));

afterEach(() => {
  captures.length = 0;
  vi.doUnmock('react-native');
  vi.resetModules();
});

it.each([false, true])('preserves props and resets incoming Text context %s', (insideText) => {
  const child = <span>label</span>;
  const props = { ref: vi.fn(), style: { width: 12 }, testID: 'box', children: child };
  renderToStaticMarkup(
    <TextAncestorContext value={insideText}>
      <NativeViewWithContext {...props} />
    </TextAncestorContext>
  );
  expect(captures).toHaveLength(1);
  expect(captures[0].context).toBe(false);
  expect(captures[0].props).toEqual(props);
  expect(captures[0].props.children).toBe(child);
  expect(captures[0].props.style).toBe(props.style);
  expect(captures[0].props.ref).toBe(props.ref);
});

it('renders the built CommonJS runtime without a global React variable', () => {
  const runtime = {} as typeof import('../index');
  runInNewContext(readFileSync(new URL('../../../dist/runtime/index.js', import.meta.url), 'utf8'), {
    exports: runtime,
    require: (name: string) => {
      if (name === 'react') return React;
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name === 'react-native')
        return {
          View: () => null,
          Image: () => null,
          Platform: { OS: 'ios' },
          unstable_NativeView: NativeView,
          unstable_TextAncestorContext: TextAncestorContext,
        };
      throw new Error(`Unexpected runtime dependency: ${name}`);
    },
  });
  renderToStaticMarkup(
    <TextAncestorContext value={true}>
      <runtime.NativeViewWithContext>
        <span>label</span>
      </runtime.NativeViewWithContext>
    </TextAncestorContext>
  );
  expect(captures).toHaveLength(1);
  expect(captures[0].context).toBe(false);
});

it('falls back to View when the native context is unavailable', async () => {
  const View = vi.fn(() => null);
  vi.doMock('react-native', () => ({ View, unstable_TextAncestorContext: undefined }));
  const runtime = await import('../components/native-view-with-context');
  expect(runtime.NativeViewWithContext).toBe(View);
});

it('falls back directly when NativeView already uses View', async () => {
  const View = vi.fn(() => null);
  vi.doMock('react-native', () => ({ View, unstable_TextAncestorContext: TextAncestorContext }));
  vi.doMock('../components/native-view', () => ({ NativeView: View }));
  const runtime = await import('../components/native-view-with-context');
  expect(runtime.NativeViewWithContext).toBe(View);
});
