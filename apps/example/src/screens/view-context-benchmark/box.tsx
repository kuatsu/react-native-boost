import type { ReactNode } from 'react';
import { View } from 'react-native';

export function Box({ children, tick }: { children: ReactNode; tick: number }) {
  return (
    <View collapsable={false} style={{ width: 2, height: 2, opacity: tick % 2 ? 0.5 : 1 }}>
      {children}
    </View>
  );
}
