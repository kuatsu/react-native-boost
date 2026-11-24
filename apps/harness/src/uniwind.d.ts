import 'react-native';

// Uniwind is installed at the workspace root, so its own types extend the root's React Native.
declare module 'react-native' {
  interface ViewProps {
    className?: string;
  }
  interface TextProps {
    className?: string;
    selectionColorClassName?: string;
  }
  interface ImagePropsBase {
    className?: string;
    tintColorClassName?: string;
  }
  interface ActivityIndicatorProps {
    colorClassName?: string;
  }
}
