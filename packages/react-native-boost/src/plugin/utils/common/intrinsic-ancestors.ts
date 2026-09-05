import type { ComponentAncestorClassification } from '../../../ancestor-types';

/** Text context supplied to rendered children, not the native host's layout context. */
export function classifyReactNativeAncestor(name: string, platform?: string): ComponentAncestorClassification {
  switch (name) {
    case 'View':
    case 'ActivityIndicator':
    case 'DrawerLayoutAndroid':
    case 'ImageBackground':
    case 'KeyboardAvoidingView':
    case 'Modal':
    case 'Pressable':
    case 'TouchableHighlight':
    case 'TouchableOpacity': {
      return 'safe';
    }
    case 'Text':
    case 'TextInput': {
      return 'text';
    }
    case 'InputAccessoryView':
    case 'RefreshControl':
    case 'Switch':
    case 'experimental_LayoutConformance': {
      return 'transparent';
    }
    case 'SafeAreaView': {
      return platform === 'ios' ? 'transparent' : platform === 'android' ? 'safe' : 'unknown';
    }
    case 'ProgressBarAndroid': {
      return platform === 'android' ? 'transparent' : platform === 'ios' ? 'safe' : 'unknown';
    }
    // Scroll/list customization and Touchable child-prop injection need more than a context summary.
    default: {
      return 'unknown';
    }
  }
}

/** Animated wrappers retain their wrapped component; they do not establish their own Text context. */
export function classifyAnimatedAncestor(name: string): ComponentAncestorClassification {
  if (name === 'View') return 'safe';
  if (name === 'Text') return 'text';
  return 'unknown';
}
