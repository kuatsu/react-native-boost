import React from 'react';
import { useState } from 'react';
import { TimeToRenderView } from 'react-native-time-to-render';
import { Text } from 'react-native';

export default function MeasureComponent(props: {
  children: React.ReactNode;
  markerName: string;
  title: string;
}): JSX.Element {
  const [renderTime, setRenderTime] = useState<number | null>(null);
  return (
    <>
      {renderTime === null ? null : (
        <Text>
          Took {renderTime}ms to render {props.title}
        </Text>
      )}
      {props.children}
      <TimeToRenderView
        markerName={props.markerName}
        onMarkerPainted={(event) => {
          setRenderTime(Math.round(event.nativeEvent.paintTime));
        }}
      />
    </>
  );
}
