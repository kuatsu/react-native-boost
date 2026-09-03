import { types as t } from '@babel/core';

export type ReactNativeComponentName = 'Image' | 'ScrollView' | 'Text' | 'View';

// Babel cannot resolve an import added during the current visitor without another scope crawl.
const reactNativeComponents = new WeakMap<t.JSXOpeningElement, ReactNativeComponentName>();

export const markReactNativeComponent = (
  openingElement: t.JSXOpeningElement,
  component: ReactNativeComponentName
): void => {
  reactNativeComponents.set(openingElement, component);
};

export const getMarkedReactNativeComponent = (
  openingElement: t.JSXOpeningElement
): ReactNativeComponentName | undefined => reactNativeComponents.get(openingElement);
