declare module 'react-native/Libraries/StyleSheet/StyleSheetExports' {
  const StyleSheet: typeof import('react-native').StyleSheet;
  export default StyleSheet;
}

declare module 'react-native/Libraries/StyleSheet/flattenStyle' {
  const flatten: typeof import('react-native').StyleSheet.flatten;
  export default flatten;
}

declare module 'react-native/Libraries/Components/View/ReactNativeStyleAttributes' {
  const attributes: Record<string, boolean | { process?: (value: unknown) => unknown }>;
  export default attributes;
}

declare module 'react-native/Libraries/ReactNative/ReactFabricPublicInstance/ReactNativeAttributePayload' {
  export function create(props: object, attributes: object): Record<string, unknown> | null;
  export function diff(previous: object, next: object, attributes: object): Record<string, unknown> | null;
}

declare module 'react-native/Libraries/Components/View/View' {
  const View: typeof import('react-native').View;
  export default View;
}

declare module 'react-native/Libraries/Text/Text' {
  const Text: typeof import('react-native').Text;
  export default Text;
}

declare module 'react-native/Libraries/Text/TextAncestorContext' {
  const TextAncestorContext: import('react').Context<boolean>;
  export default TextAncestorContext;
}

declare module 'react-native/Libraries/StyleSheet/processColor' {
  const processColor: typeof import('react-native').processColor;
  export default processColor;
}

declare module 'react-native/Libraries/Text/Text' {
  const Text: typeof import('react-native').Text;
  export default Text;
}
declare module 'react-native/Libraries/Image/Image.ios' {
  const Image: typeof import('react-native').Image;
  export default Image;
}
declare module 'react-native/Libraries/Image/Image.android' {
  const Image: typeof import('react-native').Image;
  export default Image;
}
declare module 'react-native/Libraries/Components/ActivityIndicator/ActivityIndicator' {
  const ActivityIndicator: typeof import('react-native').ActivityIndicator;
  export default ActivityIndicator;
}
