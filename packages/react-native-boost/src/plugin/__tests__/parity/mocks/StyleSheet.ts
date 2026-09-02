import { flattenStyle } from '../normalize';

const StyleSheet = {
  create: <T>(styles: T): T => styles,
  flatten: flattenStyle,
  compose: (first: unknown, second: unknown) => (second ? [first, second] : first),
};

export default StyleSheet;
