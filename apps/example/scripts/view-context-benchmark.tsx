import { AppRegistry, Platform, Text, unstable_TextAncestorContext as TextContext } from 'react-native';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { NativeView } from 'react-native-boost/runtime';
import { startMarker, TimeToRenderView, getThermalState } from 'react-native-time-to-render';
import { Box } from '../src/screens/view-context-benchmark/box';
import { Box as StockBox } from '../src/screens/view-context-benchmark/box.unoptimized';
import { ViewContextParity } from './view-context-parity';

function RawBox({ children, tick }: { children: ReactNode; tick: number }) {
  return (
    <NativeView collapsable={false} style={{ width: 2, height: 2, opacity: tick % 2 ? 0.5 : 1 }}>
      {children}
    </NativeView>
  );
}

const { enableNativeViewPropTransformations } =
  require('react-native/src/private/featureflags/ReactNativeFeatureFlags') as {
    enableNativeViewPropTransformations: () => boolean;
  };
const variants = { stock: StockBox, context: Box, raw: RawBox };
type Mode = keyof typeof variants;
type Step = { mode: Mode; count: number; insideText: boolean; tick: number; marker: string };
const server = process.env.EXPO_PUBLIC_BENCHMARK_SERVER ?? 'http://127.0.0.1:8099';
const child = <NativeView collapsable={false} style={{ width: 1, height: 1 }} />;
const delay = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function ViewContextBenchmark() {
  const [verified, setVerified] = useState(false);
  const verificationComplete = useCallback(() => setVerified(true), []);
  const [step, setStep] = useState<Step | null>(null);
  const [status, setStatus] = useState('View context benchmark');
  const started = useRef(0);
  const committed = useRef(0);
  const complete = useRef<(paintMs: number) => void>(() => {});

  useLayoutEffect(() => {
    if (step) committed.current = performance.now() - started.current;
  }, [step]);

  useEffect(() => {
    if (!verified) return;
    let cancelled = false;
    void (async () => {
      if (__DEV__) throw new Error('This benchmark requires a release bundle');
      const plan: { loads: number[]; replicates: number } = await fetch(`${server}/plan`).then((response) =>
        response.json()
      );
      const samples = [];
      let sequence = 0;
      const measure = (mode: Mode, count: number, insideText: boolean, tick: number) =>
        new Promise<{ commitMs: number; paintMs: number }>((resolve) => {
          const marker = `view-context-${sequence++}`;
          requestAnimationFrame((time) => {
            startMarker(marker, time);
            complete.current = (paintMs) => resolve({ commitMs: committed.current, paintMs });
            started.current = performance.now();
            setStep({ mode, count, insideText, tick, marker });
          });
        });

      for (let replicate = 0; replicate < plan.replicates; replicate++) {
        const loads = replicate % 2 ? [...plan.loads].reverse() : plan.loads;
        for (const count of loads) {
          for (const insideText of replicate % 2 ? [true, false] : [false, true]) {
            // Balance variant order across measured rounds.
            const modes: Mode[] = ['stock', 'context', 'raw'];
            const offset = replicate % modes.length;
            const order = [...modes.slice(offset), ...modes.slice(0, offset)];
            if (Math.floor(replicate / modes.length) % 2) order.reverse();
            for (const mode of order) {
              if (cancelled) return;
              setStep(null);
              await delay(250);
              for (const tick of [0, 1]) {
                const thermalStart = getThermalState();
                const timing = await measure(mode, count, insideText, tick);
                const sample = {
                  mode,
                  count,
                  insideText,
                  replicate,
                  phase: tick === 0 ? 'mount' : 'update',
                  thermalStart,
                  thermalEnd: getThermalState(),
                  ...timing,
                };
                samples.push(sample);
                await fetch(`${server}/measure`, { method: 'POST', body: JSON.stringify(sample) });
                await delay(100);
              }
            }
          }
        }
      }
      await fetch(`${server}/done`, {
        method: 'POST',
        body: JSON.stringify({
          platform: Platform.OS,
          reactNative: Platform.constants.reactNativeVersion,
          engine: 'HermesInternal' in globalThis ? 'Hermes' : 'other',
          development: __DEV__,
          lifecycleParity: verified,
          nativeViewPropTransformations: enableNativeViewPropTransformations(),
          samples,
        }),
      });
      setStep(null);
      setStatus('View context benchmark complete');
    })().catch((error: Error) => setStatus(error.message));
    return () => {
      cancelled = true;
    };
  }, [verified]);

  if (!verified) return <ViewContextParity onComplete={verificationComplete} />;
  const Component = step ? variants[step.mode] : Box;
  return (
    <NativeView style={{ flex: 1 }}>
      <Text>{status}</Text>
      {step && (
        <TextContext value={step.insideText}>
          <NativeView style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {Array.from({ length: step.count }, (_, index) => (
              <Component key={index} tick={step.tick}>
                {child}
              </Component>
            ))}
          </NativeView>
          <TimeToRenderView
            key={step.marker}
            markerName={step.marker}
            onMarkerPainted={(event) => complete.current(event.nativeEvent.paintTime)}
          />
        </TextContext>
      )}
    </NativeView>
  );
}

AppRegistry.registerComponent('main', () => ViewContextBenchmark);
