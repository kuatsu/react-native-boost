import './global.css';
import { useState } from 'react';
import { Pressable, SafeAreaView, Text, View } from 'react-native';
import { ScopedTheme } from 'uniwind';
import Cases from './cases';
import OriginalCases from './cases.unoptimized';

export default function UniwindParity() {
  const [dark, setDark] = useState(false);
  const [selected, setSelected] = useState(false);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#0f172a' }}>Uniwind parity</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDark(!dark)}
            style={{ padding: 10, backgroundColor: '#e2e8f0', borderRadius: 8 }}>
            <Text>Theme: {dark ? 'dark' : 'light'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setSelected(!selected)}
            style={{ padding: 10, backgroundColor: '#e2e8f0', borderRadius: 8 }}>
            <Text>Toggle selected</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={{ fontWeight: '700' }}>Original</Text>
            <ScopedTheme theme={dark ? 'dark' : 'light'}>
              <OriginalCases selected={selected} />
            </ScopedTheme>
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={{ fontWeight: '700' }}>Boost</Text>
            <ScopedTheme theme={dark ? 'dark' : 'light'}>
              <Cases selected={selected} />
            </ScopedTheme>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
