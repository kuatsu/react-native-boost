declare module 'react-native/Libraries/StyleSheet/flattenStyle' {
  type GenericStyleProp<T> = null | void | T | false | '' | ReadonlyArray<GenericStyleProp<T>>;

  export function flattenStyle<T>(style: T): T extends GenericStyleProp<infer U> ? U : never;
}
