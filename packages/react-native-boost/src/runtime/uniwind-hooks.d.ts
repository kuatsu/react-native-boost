declare module 'react-native-boost/uniwind/useStyle' {
  export function useStyle(
    className: string | undefined,
    props: object,
    state?: { isPressed: boolean; isDisabled: boolean }
  ): import('react-native').ViewStyle &
    import('react-native').TextStyle &
    import('react-native').ImageStyle & { WebkitLineClamp?: number };
}
declare module 'react-native-boost/uniwind/useAccentColor' {
  export function useAccentColor(
    className: string | undefined,
    props: object,
    state?: { isPressed: boolean; isDisabled: boolean }
  ): import('react-native').ColorValue | undefined;
}
