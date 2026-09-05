/* eslint-disable @typescript-eslint/no-require-imports,unicorn/prefer-module */

import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Image, Platform, StyleSheet, Text, View } from 'react-native';

export default function Cases({ selected }: { selected: boolean }) {
  const position = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  // @ts-expect-error RN 0.86 exports Animated.Color without a public type.
  const color = useRef(new Animated.Color('#fed7aa')).current;
  useEffect(() => {
    color.setValue(selected ? '#bbf7d0' : '#fed7aa');
  }, [color, selected]);
  return (
    <View style={{ gap: 12 }}>
      <View className="h-16 rounded-lg bg-blue-500 p-3 dark:bg-purple-600">
        <Text className="font-bold text-white">View + Text</Text>
      </View>
      <View className="h-16 rounded-lg bg-slate-100 p-2 data-[selected=true]:bg-green-200" data-selected={selected}>
        <Text disabled={selected} className="text-red-600 disabled:text-green-800">
          Disabled / data
        </Text>
        <Text className="text-xs text-slate-600">{selected ? 'Selected' : 'Not selected'}</Text>
      </View>
      <View className="h-20 rounded-lg bg-slate-100 p-2">
        <Text
          className="line-clamp-2 text-base font-bold text-blue-700"
          numberOfLines={4}
          selectionColorClassName="accent-orange-500">
          This text must stop after two lines with the same size and color.
        </Text>
      </View>
      <View className="h-20 items-center justify-center rounded-lg bg-slate-100">
        <Image
          source={require('../../../assets/icon.png')}
          className="h-12 w-12 object-contain"
          tintColorClassName="accent-blue-500 dark:accent-purple-600"
        />
      </View>
      <ActivityIndicator
        animating={false}
        hidesWhenStopped={false}
        size="large"
        className="h-16 rounded-lg bg-blue-100 dark:bg-purple-100"
        colorClassName="accent-blue-600 dark:accent-purple-600"
      />
      <Animated.View className="h-14 rounded-lg bg-orange-200 p-2">
        <Text className="text-sm text-orange-900">Animated wrapper</Text>
      </Animated.View>
      <Animated.View
        className="h-10 rounded-lg p-2"
        style={{ backgroundColor: color, transform: position.getTranslateTransform() }}>
        <Text className="text-sm text-slate-900">Animated values</Text>
      </Animated.View>
      <View
        className="h-14 rounded-lg bg-red-200 p-3"
        style={StyleSheet.compose({ backgroundColor: '#dcfce7' }, { padding: 8 })}>
        <Text className="text-sm text-green-900">{Platform.OS}: style wins</Text>
      </View>
    </View>
  );
}
