# AGENTS.md for React Native Boost

This file provides guidance to AI agents when working with code in the `react-native-boost` repository.

## What this is

`react-native-boost` is a Babel plugin that statically analyzes React Native source code and rewrites standard `Text`/`View` JSX elements into their lower-level native counterparts (`NativeText` / `NativeView`), skipping the JS-side wrapper components to gain rendering performance.

This is a pnpm monorepo. `pnpm` is required; npm/yarn will not work.

## Commands

Run from the repo root unless noted:

- `pnpm install` — install all workspace dependencies
- `pnpm build` — build every package (`-r --parallel`)
- `pnpm typecheck` — TypeScript check across packages
- `pnpm test` — run all package tests
- `pnpm lint` — Oxlint over the repo (`pnpm lint -- --fix` to autofix)
- `pnpm format` — Oxfmt

Package-scoped (the interesting work happens in `packages/react-native-boost`):

- `pnpm package build` — `rollup -c` (cleans `dist` first)
- `pnpm package test` — Vitest
- `pnpm package typecheck`

Running a single test: Vitest runs from `packages/react-native-boost`. Use `pnpm package test <pattern>` or `cd packages/react-native-boost && pnpm vitest run text`. The optimizer tests are fixture-driven (see Testing below), so to test one transform case, edit/add a fixture directory and run the matching optimizer's test file.

Example app (`apps/example`, Expo): `pnpm example start` / `pnpm example ios` / `pnpm example android`. Note `ios`/`android` scripts do `rm -rf ios`/`android` and re-run `expo run:*` (prebuild from scratch).

Commit messages follow Conventional Commits; a commitlint pre-commit hook enforces this. Lint + tests also run on pre-commit via Husky/lint-staged.

## Architecture

### Package layout

- `packages/react-native-boost` — the published package. Two independent entry points:
  - `react-native-boost/plugin` — the Babel plugin (`src/plugin`)
  - `react-native-boost/runtime` — the runtime helper library (`src/runtime`), imported into user code by the plugin
- `packages/react-native-time-to-render` — a private RN TurboModule used by the example app to measure render time for benchmarking
- `apps/example` — Expo benchmark and example app
- `apps/docs` — Docusaurus documentation site

### Plugin pipeline (`src/plugin`)

Entry: `src/plugin/index.ts`. A single Babel visitor on `JSXOpeningElement` runs each enabled optimizer per element. Per-file state holds the logger; `isIgnoredFile` short-circuits ignored paths.

Optimizers live in `src/plugin/optimizers/{text,view}/index.ts`. Both follow the same shape:

1. Guard: `isValidJSXComponent` + `isReactNativeImport` confirm the element is the RN component (not a same-named local).
2. **Bailout checks** (`BailoutCheck[]` + `getFirstBailoutReason` in `utils/helpers.ts`): a component is only rewritten if it passes every safety check. Each optimizer defines its own blacklisted props and structural checks. When a check fails, the element is left untouched and logged as `skipped`.
3. **Forcing/ignoring**: line comments `@boost-force` (`isForcedLine`) override _overridable_ bailouts; `@boost-ignore` (`isIgnoredLine`) skips a line. Note dynamic `Text` requires `@boost-force` to be optimized.
4. Rewrite via `replaceWithNativeComponent`, which swaps the JSX name and injects the needed runtime import into the file.

Key safety logic is in `src/plugin/utils/common/validation.ts`.

Some optimizers also rewrite props at compile time, i.e. the `Text` optimizer extracts `style`/accessibility/`userSelect` into runtime helper calls (`processTextStyle`, `processAccessibilityProps`) injected as imports, adds defaults (`allowFontScaling`, `ellipsizeMode`), and fixes negative `numberOfLines`.

### Runtime library (`src/runtime`)

`NativeText`/`NativeView` (`src/runtime/components`) resolve at module load and gracefully fall back to standard `Text`/`View` on web or when the unstable export is missing. `helpers.ts` holds `processTextStyle` / `processAccessibilityProps` (the functions the plugin's generated imports call). `index.web.ts` is the web build that falls back fully.

### Plugin options

Typed in `src/plugin/types/index.ts` (`PluginOptions`): `ignores`, `verbose`, `silent`, `optimizations.{text,view}`, `dangerouslyOptimizeViewWithUnknownAncestors`.

## Build (`rollup.config.mjs`)

Rollup emits separate CJS + ESM + `.d.ts` bundles for each of: `runtime`, `runtime.web`, and `plugin`. The root `runtime.js`/`plugin.js` shims re-export from `dist`. After editing plugin/runtime source you must rebuild (`pnpm package build`) for the example app or any consumer to pick up changes — `pnpm dev` does this in watch mode.

## Testing

Optimizer tests use `babel-plugin-tester` with **fixture directories** under `optimizers/{text,view}/__tests__/fixtures/<case>/`, each containing `code.js` (input) and `output.js` (expected transform). Some cases have `dangerous-output.js` variants for the dangerous-ancestor option. `generate-test-plugin.ts` wraps a single optimizer into a standalone Babel plugin for isolated testing; `format-test-result.ts` normalizes output. Vitest aliases `react-native` to a mock (`src/runtime/__tests__/mocks/react-native.ts`) — see `vitest.config.ts`. To add a transform test, add a new fixture directory; no test code changes needed.

## Tooling notes

- Lint/format is **Oxlint + Oxfmt** (oxc), not ESLint/Prettier. Config: `.oxlintrc.json`, `.oxfmtrc.json`.
- The example app keeps `*.unoptimized.tsx` twins generated by `apps/example/scripts/gen-unoptimized.mjs` (runs on `prestart`/`preios`/`preandroid`) used by the example app to showcase performance differences. These are GENERATED — edit the canonical source listed in the script and re-run, don't edit the twins.
