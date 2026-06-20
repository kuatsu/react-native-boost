/**
 * A drop-in `react/jsx-runtime` that delegates to the real one and increments a global counter on every
 * `jsx`/`jsxs`/`jsxDEV` call. The parity config redirects `react/jsx-runtime` + `react/jsx-dev-runtime`
 * here only while the fibers collector runs (BENCH_FIBERS_OUT set), so every rendered node — including
 * the ones the real RN `Text`/`View` wrappers create internally — is counted. The real runtime is
 * required via Node resolution to bypass the vite redirect (avoiding an import loop); element identity
 * (`$$typeof`) is shared across React copies via `Symbol.for`, so react-dom renders them fine.
 */
import { createRequire } from 'node:module';

type JsxFn = (type: unknown, props: unknown, key?: unknown, ...rest: unknown[]) => unknown;
interface JsxRuntime {
  Fragment: unknown;
  jsx: JsxFn;
  jsxs: JsxFn;
  jsxDEV?: JsxFn;
}

const real = createRequire(import.meta.url)('react/jsx-runtime') as JsxRuntime;
const counters = globalThis as { __JSX_COUNT__?: number };

const bump = (): void => {
  counters.__JSX_COUNT__ = (counters.__JSX_COUNT__ ?? 0) + 1;
};

export const Fragment = real.Fragment;

export const jsx: JsxFn = (type, props, key) => {
  bump();
  return real.jsx(type, props, key);
};

export const jsxs: JsxFn = (type, props, key) => {
  bump();
  return real.jsxs(type, props, key);
};

// `jsxDEV` is used when Babel compiles with the development automatic runtime.
export const jsxDEV: JsxFn = (type, props, key, ...rest) => {
  bump();
  return (real.jsxDEV ?? real.jsx)(type, props, key, ...rest);
};
