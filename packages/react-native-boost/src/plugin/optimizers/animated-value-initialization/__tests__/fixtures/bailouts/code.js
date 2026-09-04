import { useRef, useState } from 'react';
import { Animated } from 'react-native';
import { Animated as OtherAnimated } from 'other';

const initialValue = 0;
const current = useRef(new Animated.Value(initialValue)).current;
const ref = useRef(new Animated.Value(0));
useRef(new Animated.Value(0)).current = current;
const [state] = useState(new Animated.Value(initialValue));
const configured = useRef(new Animated.Value(0, getConfig())).current;
const other = useRef(new OtherAnimated.Value(0)).current;
const localUseRef = (value) => ({ current: value });
const local = localUseRef(new Animated.Value(0)).current;

/* @boost-ignore */
const ignored = useRef(new Animated.Value(0)).current;
