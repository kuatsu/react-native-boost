import { codegenNativeComponent, type ViewProps } from 'react-native';
import { DirectEventHandler, Double } from 'react-native/Libraries/Types/CodegenTypes';

export interface NativeProps extends ViewProps {
  markerName: string;
  onMarkerPainted: DirectEventHandler<{ paintTime: Double }>;
}

export default codegenNativeComponent<NativeProps>('TimeToRender');
