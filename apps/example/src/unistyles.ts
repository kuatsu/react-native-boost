import { StyleSheet } from 'react-native-unistyles';

const lightTheme = {
  colors: {
    background: '#ffffff',
    card: '#f2f4f7',
    border: '#d9dee5',
    text: '#0b0e11',
    muted: '#5b6470',
    accent: '#2962ff',
  },
  gap: (v: number) => v * 8,
};

const darkTheme = {
  colors: {
    background: '#0b0e11',
    card: '#12161c',
    border: '#2a3139',
    text: '#eaecef',
    muted: '#9aa3ad',
    accent: '#f0b90b',
  },
  gap: (v: number) => v * 8,
};

const appThemes = {
  light: lightTheme,
  dark: darkTheme,
};

const breakpoints = {
  xs: 0,
  sm: 380,
  md: 600,
  lg: 900,
  xl: 1200,
};

type AppThemes = typeof appThemes;
type AppBreakpoints = typeof breakpoints;

/* oxlint-disable no-empty-object-type */
declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}
/* oxlint-enable no-empty-object-type */

StyleSheet.configure({
  settings: {
    initialTheme: 'dark',
    adaptiveThemes: false,
  },
  breakpoints,
  themes: appThemes,
});
