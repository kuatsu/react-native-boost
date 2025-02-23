/* eslint-disable unicorn/prevent-abbreviations, unicorn/filename-case */
import type { ViewProps } from 'react-native';
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
import { DirectEventHandler, Double } from 'react-native/Libraries/Types/CodegenTypes';

export interface NativeProps extends ViewProps {
  markerName: string;
  onMarkerPainted: DirectEventHandler<{ paintTime: Double }>;
}

export default codegenNativeComponent<NativeProps>('TimeToRender');
