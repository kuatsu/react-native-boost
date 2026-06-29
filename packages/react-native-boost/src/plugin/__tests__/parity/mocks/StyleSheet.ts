import { flattenStyle } from '../normalize';

const StyleSheet = {
  create: <T>(styles: T): T => styles,
  flatten: flattenStyle,
};

export default StyleSheet;
