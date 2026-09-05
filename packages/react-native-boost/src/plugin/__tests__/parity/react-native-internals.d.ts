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
