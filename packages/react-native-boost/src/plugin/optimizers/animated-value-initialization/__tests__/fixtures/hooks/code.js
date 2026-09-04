import React, { useRef as keep, useState } from 'react';
import * as RN from 'react-native';
import { Animated as Motion } from 'react-native';

const value = keep(new Motion.Value(-1, { useNativeDriver: false })).current;
const namespacedValue = React.useRef(new RN.Animated.Value(2)).current;
const position = keep(new Motion.ValueXY({ x: 0, y: 1 })).current;
const color = React.useRef(new Motion.Color('#fff')).current;
const [stateValue] = useState(new Motion.Value(3));
const [statePosition] = React.useState(new Motion.ValueXY());
const [stateColor] = useState(new Motion.Color({ r: 1, g: 0, b: 0, a: 1 }));
