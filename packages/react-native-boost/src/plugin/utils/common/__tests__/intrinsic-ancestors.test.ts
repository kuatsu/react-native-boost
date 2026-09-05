import { transformSync, type PluginObj, type TransformCaller } from '@babel/core';
import { describe, expect, it } from 'vitest';
import type { ComponentAncestorClassification, ModuleAncestorAnalysis } from '../../../../ancestor-types';
import { analyzeAncestorModule } from '../validation';

function analyze(source: string, platform?: string): ModuleAncestorAnalysis {
  let analysis: ModuleAncestorAnalysis | undefined;
  transformSync(source, {
    filename: 'ancestors.tsx',
    configFile: false,
    babelrc: false,
    caller: { name: 'test', ...(platform ? { platform } : {}) } as TransformCaller,
    parserOpts: { plugins: ['jsx', 'typescript'] },
    plugins: [
      (): PluginObj => ({
        visitor: {
          Program(path) {
            analysis = analyzeAncestorModule(path);
          },
        },
      }),
    ],
  });
  return analysis!;
}

function classify(imports: string, component: string, platform?: string): ComponentAncestorClassification {
  return analyze(
    `${imports}\nexport const Wrapper = ({ children }) => <${component}>{children}</${component}>;`,
    platform
  ).exports.Wrapper as ComponentAncestorClassification;
}

const nativeComponents: Record<string, ComponentAncestorClassification> = {
  ActivityIndicator: 'safe',
  Button: 'unknown',
  DrawerLayoutAndroid: 'safe',
  FlatList: 'unknown',
  Image: 'unknown',
  ImageBackground: 'safe',
  InputAccessoryView: 'transparent',
  KeyboardAvoidingView: 'safe',
  Modal: 'safe',
  Pressable: 'safe',
  ProgressBarAndroid: 'unknown',
  RefreshControl: 'transparent',
  SafeAreaView: 'unknown',
  ScrollView: 'unknown',
  SectionList: 'unknown',
  StatusBar: 'unknown',
  Switch: 'transparent',
  Text: 'text',
  TextInput: 'text',
  TouchableHighlight: 'safe',
  TouchableNativeFeedback: 'unknown',
  TouchableOpacity: 'safe',
  TouchableWithoutFeedback: 'unknown',
  View: 'safe',
  VirtualizedList: 'unknown',
  VirtualizedSectionList: 'unknown',
  experimental_LayoutConformance: 'transparent',
  unstable_NativeText: 'unknown',
  unstable_NativeView: 'unknown',
  unstable_VirtualView: 'unknown',
  unstable_VirtualArray: 'unknown',
  unstable_VirtualColumn: 'unknown',
  unstable_VirtualColumnGenerator: 'unknown',
  unstable_VirtualRow: 'unknown',
};

describe('intrinsic ancestor summaries', () => {
  it.each(Object.entries(nativeComponents))('%s supplies %s', (name, expected) => {
    expect(classify(`import { ${name} as Component } from 'react-native';`, 'Component')).toBe(expected);
    expect(classify(`import * as RN from 'react-native';`, `RN.${name}`)).toBe(expected);
    expect(analyze(`export { ${name} as Component } from 'react-native';`).exports.Component).toBe(expected);
  });

  it.each([
    ['ios', 'transparent', 'safe'],
    ['android', 'safe', 'transparent'],
    ['web', 'unknown', 'unknown'],
  ])('resolves platform-dependent hosts on %s', (platform, safeArea, progress) => {
    expect(classify(`import { SafeAreaView } from 'react-native';`, 'SafeAreaView', platform)).toBe(safeArea);
    expect(classify(`import * as RN from 'react-native';`, 'RN.ProgressBarAndroid', platform)).toBe(progress);
    expect(analyze(`export { SafeAreaView } from 'react-native';`, platform).exports.SafeAreaView).toBe(safeArea);
  });

  it.each(['react-native', 'react-native-reanimated'])('preserves %s Animated host context', (source) => {
    const imports =
      source === 'react-native' ? `import { Animated as Motion } from '${source}';` : `import Motion from '${source}';`;
    for (const [component, expected] of Object.entries({
      View: 'safe',
      Text: 'text',
      Image: 'unknown',
      ScrollView: 'unknown',
      FlatList: 'unknown',
      SectionList: 'unknown',
    })) {
      expect(classify(imports, `Motion.${component}`)).toBe(expected);
      const namespace = source === 'react-native' ? 'Library.Animated' : 'Library.default';
      expect(classify(`import * as Library from '${source}';`, `${namespace}.${component}`)).toBe(expected);
      expect(classify(`${imports} const Component = Motion.${component};`, 'Component')).toBe(expected);
    }
  });

  it.each([
    [`import { Animated } from 'react-native';`, 'Animated.createAnimatedComponent'],
    [`import * as RN from 'react-native';`, 'RN.Animated.createAnimatedComponent'],
    [`import Animated from 'react-native-reanimated';`, 'Animated.createAnimatedComponent'],
    [`import { createAnimatedComponent as animate } from 'react-native-reanimated';`, 'animate'],
    [`import * as Reanimated from 'react-native-reanimated';`, 'Reanimated.createAnimatedComponent'],
  ])('follows a known Animated factory: %s', (imports, factory) => {
    for (const [component, expected] of Object.entries({ View: 'safe', Text: 'text', ScrollView: 'unknown' })) {
      expect(
        classify(
          `${imports} import * as Native from 'react-native'; const Component = ${factory}(Native.${component});`,
          'Component'
        )
      ).toBe(expected);
    }
    expect(
      classify(
        `${imports} const Pass = ({children}) => <>{children}</>; const Component = ${factory}(Pass);`,
        'Component'
      )
    ).toBe('transparent');
    expect(classify(`${imports} const Component = ${factory}(Unknown);`, 'Component')).toBe('unknown');
  });

  it('separates variable context from unsafe child handling', () => {
    expect(
      analyze(`
      import React from 'react';
      import { Text, View } from 'react-native';
      export function Mixed({children, inline}) {
        if (inline) return <Text>{children}</Text>;
        return children;
      }
      export function ResetOrPass({children, reset}) {
        if (reset) return <View>{children}</View>;
        return children;
      }
      export function UnsafeLast({children, inline}) {
        if (inline) return <Text>{children}</Text>;
        return React.cloneElement(children, {'aria-label': 'Name'});
      }
      export function UnsafeFirst({children, inline}) {
        if (!inline) return React.cloneElement(children, {'aria-label': 'Name'});
        return <Text>{children}</Text>;
      }
    `).exports
    ).toMatchObject({
      Mixed: 'context',
      ResetOrPass: 'context',
      UnsafeLast: 'unknown',
      UnsafeFirst: 'unknown',
    });
  });

  it('follows a reset behind a transparent intrinsic', () => {
    expect(
      analyze(`
      import { Text, View, RefreshControl } from 'react-native';
      export const Safe = ({children}) => <View><RefreshControl>{children}</RefreshControl></View>;
      export const Inline = ({children}) => <Text><RefreshControl>{children}</RefreshControl></Text>;
    `).exports
    ).toMatchObject({ Safe: 'safe', Inline: 'text' });
  });

  it('keeps customized and child-cloning wrappers unknown even behind a View', () => {
    for (const component of ['ScrollView', 'FlatList', 'TouchableWithoutFeedback', 'TouchableNativeFeedback']) {
      expect(
        analyze(
          `import { View, ${component} } from 'react-native'; export const Wrapper = ({children}) => <View><${component}>{children}</${component}></View>;`
        ).exports.Wrapper
      ).toBe('unknown');
    }
  });

  it('does not confuse names, namespace exports, or type imports with runtime components', () => {
    expect(classify(`import * as Reanimated from 'react-native-reanimated';`, 'Reanimated.View')).toBe('unknown');
    expect(classify(`import { View } from 'react-native-reanimated';`, 'View')).toBe('unknown');
    expect(classify(`import Animated from 'other-library';`, 'Animated.View')).toBe('unknown');
    expect(classify(`import type { Pressable } from 'react-native';`, 'Pressable')).toBe('unknown');
    expect(classify(`import type * as RN from 'react-native';`, 'RN.View')).toBe('unknown');
    expect(classify(`const Animated = { View: Unknown };`, 'Animated.View')).toBe('unknown');
    expect(
      classify(
        `import { createAnimatedComponent } from 'other-library'; import { View } from 'react-native'; const Component = createAnimatedComponent(View);`,
        'Component'
      )
    ).toBe('unknown');
    expect(
      classify(
        `import Animated from 'react-native-reanimated'; import { View } from 'react-native'; let Component = Animated.createAnimatedComponent(View); Component = Unknown;`,
        'Component'
      )
    ).toBe('unknown');
  });
});
