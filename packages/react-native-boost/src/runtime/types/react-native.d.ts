declare module 'react-native/Libraries/StyleSheet/flattenStyle' {
  type GenericStyleProp<T> = null | void | T | false | '' | ReadonlyArray<GenericStyleProp<T>>;

  export default function flattenStyle<T>(style: T): T extends GenericStyleProp<infer U> ? U : never;
}

declare module 'react-native/Libraries/Text/TextNativeComponent' {
  export const NativeText: React.ComponentType<TextProps>;
}

declare module 'react-native/Libraries/Components/View/ViewNativeComponent' {
  export default React.ComponentType<ViewProps>;
}
