# @react-native-boost/benchmark

A one-command, cross-platform render-performance benchmark for React Native Boost. It captures **p50/p95
FPS across a load sweep** on iOS and Android, a deterministic **fiber-count saving**, draws **graphs**, and
**archives every run** keyed by `(React Native version × Boost commit SHA)` so the effect can be tracked as
RN evolves.

## Usage

```bash
pnpm benchmark                       # fibers + FPS on every available platform (release), then graphs
pnpm benchmark -- --only fibers      # headless structural metric only — no device, no build
pnpm benchmark -- --platform ios     # one platform
pnpm benchmark -- --loads 34,160,300 # override the load sweep (rows per side; on-device range 34–300)
pnpm benchmark -- --mode debug       # debug build instead of release
pnpm benchmark -- --report-only      # redraw graphs + index from the existing archive
```

> Flags go after `--` so pnpm forwards them to the CLI.

**Targets are auto-detected** — a connected physical device is preferred, otherwise a booted simulator /
running emulator. The platform is skipped (with a note) if nothing is available, unless you named it with
`--platform`. Release is the default; the build embeds the JS bundle so the run is headless (no Metro).

## What it measures

- **FPS sweep** — for each load and each Boost mode (off → on), the app renders a long, live-updating list
  of `Text`/`View` rows under a streaming feed and reports avg FPS, p50/p95 frame time, and dropped-frame %.
  Boost on vs off is a real A/B: the optimized list is transformed by the plugin, its `.unoptimized` twin is
  excluded — same component tree, only the wrapper tax differs.
- **Fibers** — a headless, device-free render of one list row through the real RN wrapper pipeline, counting
  the React tree nodes Boost removes. Deterministic; doubles as a correctness guard.

## Architecture

A four-stage pipeline joined by one typed JSON contract (`src/schema.ts`):

```
context ─▶ collectors ─▶ store ─▶ report
          ├─ fibers (headless vitest render, src/collectors/fibers.ts)
          └─ fps    (server + device driver, src/collectors/fps.ts)
```

The FPS collector is the only device-coupled part. It:

1. auto-detects the target (`device.ts`) and the host the app should call (`localhost` for an iOS sim,
   `10.0.2.2` for an Android emulator, the LAN IP for a physical device);
2. stands up an HTTP control server (`server.ts`) that serves the sweep plan and collects results;
3. builds + launches the app via the Expo CLI (`driver.ts`) with `EXPO_PUBLIC_BENCHMARK=1` and
   `EXPO_PUBLIC_BENCHMARK_SERVER` baked in;
4. the app's self-driving mode (`apps/example/src/screens/benchmark-runner`) pulls the plan, runs the
   sweep, and POSTs each measurement back.

## Output

Everything is committed to the repo so results are reviewable in PRs:

Each chart is emitted as a dark and a light SVG (`*-light.svg`); the Markdown embeds them in a `<picture>`
so GitHub shows whichever matches the reader's color scheme.

```
benchmarks/
  README.md                              # auto-generated archive index + cross-version trend
  graphs/trend.svg  trend-light.svg      # Boost FPS gain across RN versions
  results/rn-<rn>/boost-<sha>/
    context.json  fibers.json  ios.json  android.json
    report.md
    graphs/fps-ios.svg  fps-ios-light.svg  fps-android.svg  fps-android-light.svg  fibers.svg  fibers-light.svg
```

## Requirements

- A booted iOS simulator / running Android emulator, or a connected device.
- Xcode (iOS) / Android SDK + `adb` for the platform(s) you run.
- The fibers stage needs neither — it runs anywhere `pnpm test` does.
