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
  const component = props.step === BenchmarkStep.Unoptimized ? props.unoptimizedComponent : props.optimizedComponent;
  const views = Array.from({ length: props.count }, (_, index) =>
    React.cloneElement(component as React.ReactElement, { key: index })
  );

  return (
    <>
      <TimeToRenderView
        markerName={props.markerName}
        onMarkerPainted={(event) => {
          props.onRenderTimeChange(Math.round(event.nativeEvent.paintTime));
        }}
      />
      <View style={{ display: 'none' }}>{views}</View>
    </>
  );
}
