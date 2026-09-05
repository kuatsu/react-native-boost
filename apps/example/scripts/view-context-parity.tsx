import { cloneElement, use, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { View, unstable_TextAncestorContext as TextContext } from 'react-native';
import { NativeViewWithContext } from 'react-native-boost/runtime';

const steps = [
  { insideText: false, key: 'a' },
  { insideText: false, key: 'a' },
  { insideText: true, key: 'a' },
  { insideText: true, key: 'a' },
  { insideText: false, key: 'a' },
  { insideText: false, key: 'b' },
];

function Probe({ allocate, report }: { allocate: () => number; report: (event: string) => void }) {
  const [instance] = useState(allocate);
  const insideText = use(TextContext);
  useLayoutEffect(() => {
    if (insideText) throw new Error('View did not reset Text context');
    report(`render:${instance}`);
  });
  useLayoutEffect(() => () => report(`unmount:${instance}`), [instance, report]);
  return null;
}

export function ViewContextParity({ onComplete }: { onComplete: () => void }) {
  const [index, setIndex] = useState(0);
  const baseline = useRef<string[]>([]);
  const events = useRef<string[]>([]);
  const identifier = useRef(0);
  const allocate = useCallback(() => identifier.current++, []);
  const report = useCallback((event: string) => events.current.push(event), []);
  const captureRef = useCallback((instance: unknown) => {
    events.current.push(instance ? 'ref:attach' : 'ref:detach');
    return () => {
      events.current.push('ref:cleanup');
    };
  }, []);
  const phase = index % (steps.length + 1);
  const stock = index < steps.length + 1;
  const Component = stock ? View : NativeViewWithContext;
  const step = steps[phase];

  useLayoutEffect(() => {
    if (!step) {
      if (stock) {
        baseline.current = [...events.current];
        events.current = [];
        identifier.current = 0;
      } else {
        if (JSON.stringify(events.current) !== JSON.stringify(baseline.current)) {
          throw new Error(
            `View lifecycle mismatch: ${JSON.stringify({ baseline: baseline.current, context: events.current })}`
          );
        }
        onComplete();
        return;
      }
    }
    const frame = requestAnimationFrame(() => setIndex((value) => value + 1));
    return () => cancelAnimationFrame(frame);
  }, [index, onComplete, step, stock]);

  return step ? (
    <TextContext value={step.insideText}>
      {cloneElement(
        <Component key={step.key} ref={captureRef} collapsable={false}>
          <Probe allocate={allocate} report={report} />
        </Component>,
        { testID: `cloned-${index}` }
      )}
    </TextContext>
  ) : null;
}
