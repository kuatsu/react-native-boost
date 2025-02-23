import React from 'react';
import { TimeToRenderView } from 'react-native-time-to-render';
import { Benchmark, BenchmarkStep } from '../types';
import { View } from 'react-native';

export interface BenchmarkProperties extends Benchmark {
  onRenderTimeChange: (renderTime: number) => void;
  step: BenchmarkStep;
  markerName: string;
}
export default function MeasureComponent(props: BenchmarkProperties) {
  const optimizedViews = Array.from({ length: props.count }, (_, index) =>
    React.cloneElement(props.optimizedComponent as React.ReactElement, { key: `optimized-${index}` })
  );
  const unoptimizedViews = Array.from({ length: props.count }, (_, index) =>
    React.cloneElement(props.unoptimizedComponent as React.ReactElement, { key: `unoptimized-${index}` })
  );

  if (props.step === BenchmarkStep.Unoptimized) {
    return (
      <>
        <TimeToRenderView
          markerName={props.markerName}
          onMarkerPainted={(event) => {
            props.onRenderTimeChange(Math.round(event.nativeEvent.paintTime));
          }}
        />
        <View style={{ display: 'none' }}>{unoptimizedViews}</View>
      </>
    );
  }

  return (
    <>
      <TimeToRenderView
        markerName={props.markerName}
        onMarkerPainted={(event) => {
          props.onRenderTimeChange(Math.round(event.nativeEvent.paintTime));
        }}
      />
      <View style={{ display: 'none' }}>{optimizedViews}</View>
    </>
  );
}
