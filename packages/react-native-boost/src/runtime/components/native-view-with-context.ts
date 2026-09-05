import { use } from 'react';
import { jsx } from 'react/jsx-runtime';
import type { ComponentPropsWithRef, ComponentType } from 'react';
import * as reactNativeModule from 'react-native';
import { NativeView } from './native-view';

const { View, unstable_TextAncestorContext: TextAncestorContext } = reactNativeModule;

export const NativeViewWithContext: ComponentType<ComponentPropsWithRef<typeof View>> =
  TextAncestorContext == null || NativeView === View
    ? View
    : function NativeViewWithContext(props) {
        const hasTextAncestor = use(TextAncestorContext);
        const view = jsx(NativeView, props);
        return hasTextAncestor ? jsx(TextAncestorContext, { value: false, children: view }) : view;
      };
