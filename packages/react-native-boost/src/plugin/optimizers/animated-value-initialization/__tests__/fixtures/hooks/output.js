import {
  useAnimatedValue as _useAnimatedValue,
  useAnimatedValueXY as _useAnimatedValueXY,
  useAnimatedColor as _useAnimatedColor,
} from 'react-native';
import React, { useRef as keep, useState } from 'react';
import * as RN from 'react-native';
import { Animated as Motion } from 'react-native';
const value = _useAnimatedValue(-1, {
  useNativeDriver: false,
});
const namespacedValue = _useAnimatedValue(2);
const position = _useAnimatedValueXY({
  x: 0,
  y: 1,
});
const color = _useAnimatedColor('#fff');
const [stateValue] = useState(() => new Motion.Value(3));
const [statePosition] = React.useState(() => new Motion.ValueXY());
const [stateColor] = useState(
  () =>
    new Motion.Color({
      r: 1,
      g: 0,
      b: 0,
      a: 1,
    })
);
