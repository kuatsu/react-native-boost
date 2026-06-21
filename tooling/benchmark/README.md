# @react-native-boost/benchmark

A one-command, cross-platform render-performance benchmark for React Native Boost. It captures **avg FPS plus
p50/p95 frame times across a load sweep** on iOS and Android, a deterministic **fiber-count saving**, draws **graphs**, and
**archives every run** keyed by `(React Native version × Boost commit SHA)` so the effect can be tracked as
RN evolves.

## Usage

```bash
pnpm benchmark                       # fibers + FPS (both profiles) on every available platform, then graphs
pnpm benchmark -- --only fibers      # headless structural metric only — no device, no build
pnpm benchmark -- --platform ios     # one platform
pnpm benchmark -- --loads 34,160,300 # override the load sweep (rows per side; on-device range 34–300)
pnpm benchmark -- --mode debug       # debug build instead of release
pnpm benchmark -- --profiles default # only the stock-RN profile (today's two-series output; ~½ the FPS time)
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

### Three series: baseline, core-optimized, Boost

RN core is now trimming the same JS-`Text` wrapper overhead Boost removes — the first lever is the
`reduceDefaultPropsInText` feature flag (RN ≥ 0.82). So the FPS sweep runs under two **build profiles**:

- **`default`** — stock RN (`baseline`).
- **`core`** — stock RN **plus the curated set of RN-core overhead-reduction flags** (`config.ts`'s
  `BUILD_PROFILES`). Its baseline (`baseline-optimized`) is the new middle series.

The flag is read once at RN module-init, so it's a property of the **whole build**, not a render step — each
profile is a separate build (the override is baked in via `EXPO_PUBLIC_BENCHMARK_RN_FLAGS`). The headline
becomes a **convergence**: as core improves across RN versions, does `baseline-optimized` rise to meet
`boost`? Because the two profiles build minutes apart, the flag-invariant `boost` curve is used as a
per-load **thermal anchor** to put `baseline-optimized` on the baseline build's axis; a per-load boost-curve
divergence past 8% marks the run anchor-suspect (warned in the report).

Running both profiles roughly **doubles the FPS wall-clock** (two builds + two sweeps per platform); the
fibers stage is profile-agnostic and runs once. Use `--profiles default` for the fast, two-series path while
iterating. On RN < 0.82 the `core` profile no-ops (forcing an absent flag is ignored), so `baseline-optimized`
correctly equals `baseline` for those versions.

## Architecture

A four-stage pipeline joined by one typed JSON contract (`src/schema.ts`):

```text
context ─▶ collectors ─▶ store ─▶ report
          ├─ fibers (headless vitest render, src/collectors/fibers.ts)
          └─ fps    (server + device driver, src/collectors/fps.ts)
```

The FPS collector is the only device-coupled part. It:

1. auto-detects the target (`device.ts`) and the host the app should call (`localhost` for an iOS sim,
   `10.0.2.2` for an Android emulator, the LAN IP for a physical device);
2. stands up an HTTP control server (`server.ts`) that serves the sweep plan and collects results;
3. for each build profile, builds + launches the app via the Expo CLI (`driver.ts`) with
   `EXPO_PUBLIC_BENCHMARK=1`, `EXPO_PUBLIC_BENCHMARK_SERVER`, and the profile's
   `EXPO_PUBLIC_BENCHMARK_RN_FLAGS` baked in, then verifies the running bundle echoes those flags on the
   plan request (a staleness handshake — a cached bundle running the wrong profile fails the run loudly);
4. the app's self-driving mode (`apps/example/src/screens/benchmark-runner`) pulls the plan, runs the
   sweep, and POSTs each sample back; the host stamps the build `profile` onto each on receipt.

## Output

Everything is committed to the repo so results are reviewable in PRs:

Each chart is emitted as a dark and a light SVG (`*-light.svg`); the Markdown embeds them in a `<picture>`
so GitHub shows whichever matches the reader's color scheme.

```text
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
