declare module 'react-native/Libraries/Text/TextNativeComponent' {
  export const NativeText: React.ComponentType<TextProps>;
}

declare module 'react-native/Libraries/Components/View/ViewNativeComponent' {
  export default React.ComponentType<ViewProps>;
}

declare module 'react-native/Libraries/Image/ImageViewNativeComponent' {
  export default React.ComponentType<ImageProps>;
}

declare module 'react-native/src/private/featureflags/ReactNativeFeatureFlags' {
  // Declared optional: the getter only exists on RN >= 0.85, so consumers must guard the access.
  export const defaultTextToOverflowHidden: (() => boolean) | undefined;
  // Declared optional: the getter exists only on RN 0.85 (added there, removed again in 0.86 once the
  // behavior became unconditional), so consumers must guard the access.
  export const fixImageSrcDimensionPropagation: (() => boolean) | undefined;
}
