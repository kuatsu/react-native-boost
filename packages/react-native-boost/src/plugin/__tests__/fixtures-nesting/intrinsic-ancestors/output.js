import {
  NativeView as _NativeView,
  getDefaultTextStyle as _getDefaultTextStyle,
  getDefaultTextAccessible as _getDefaultTextAccessible,
  NativeText as _NativeText,
  NativeViewWithContext as _NativeViewWithContext,
} from 'react-native-boost/runtime';
import {
  Text,
  View,
  Pressable,
  TouchableOpacity,
  TouchableHighlight,
  KeyboardAvoidingView,
  ImageBackground,
  Modal,
  DrawerLayoutAndroid,
  RefreshControl,
  TextInput,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import * as Native from 'react-native';
const Root = () => (
  <Pressable>
    <_NativeView>
      <_NativeText
        style={_getDefaultTextStyle()}
        allowFontScaling={true}
        ellipsizeMode={'tail'}
        accessible={_getDefaultTextAccessible()}>
        label
      </_NativeText>
    </_NativeView>
  </Pressable>
);
const Pass = () => (
  <RefreshControl>
    <_NativeViewWithContext>
      <_NativeText
        style={_getDefaultTextStyle()}
        allowFontScaling={true}
        ellipsizeMode={'tail'}
        accessible={_getDefaultTextAccessible()}>
        label
      </_NativeText>
    </_NativeViewWithContext>
  </RefreshControl>
);
<Text>
  <Pressable>
    <_NativeText
      style={_getDefaultTextStyle()}
      allowFontScaling={true}
      ellipsizeMode={'tail'}
      accessible={_getDefaultTextAccessible()}>
      pressable
    </_NativeText>
  </Pressable>
  <TouchableOpacity>
    <_NativeText
      style={_getDefaultTextStyle()}
      allowFontScaling={true}
      ellipsizeMode={'tail'}
      accessible={_getDefaultTextAccessible()}>
      opacity
    </_NativeText>
  </TouchableOpacity>
  <TouchableHighlight>
    <_NativeText
      style={_getDefaultTextStyle()}
      allowFontScaling={true}
      ellipsizeMode={'tail'}
      accessible={_getDefaultTextAccessible()}>
      highlight
    </_NativeText>
  </TouchableHighlight>
  <KeyboardAvoidingView>
    <_NativeText
      style={_getDefaultTextStyle()}
      allowFontScaling={true}
      ellipsizeMode={'tail'}
      accessible={_getDefaultTextAccessible()}>
      keyboard
    </_NativeText>
  </KeyboardAvoidingView>
  <ImageBackground>
    <_NativeText
      style={_getDefaultTextStyle()}
      allowFontScaling={true}
      ellipsizeMode={'tail'}
      accessible={_getDefaultTextAccessible()}>
      background
    </_NativeText>
  </ImageBackground>
  <Modal>
    <_NativeText
      style={_getDefaultTextStyle()}
      allowFontScaling={true}
      ellipsizeMode={'tail'}
      accessible={_getDefaultTextAccessible()}>
      modal
    </_NativeText>
  </Modal>
  <DrawerLayoutAndroid>
    <_NativeText
      style={_getDefaultTextStyle()}
      allowFontScaling={true}
      ellipsizeMode={'tail'}
      accessible={_getDefaultTextAccessible()}>
      drawer
    </_NativeText>
  </DrawerLayoutAndroid>
  <Native.Pressable>
    <_NativeText
      style={_getDefaultTextStyle()}
      allowFontScaling={true}
      ellipsizeMode={'tail'}
      accessible={_getDefaultTextAccessible()}>
      namespace
    </_NativeText>
  </Native.Pressable>
  <RefreshControl>
    <Text>still inline</Text>
  </RefreshControl>
</Text>;
<_NativeView>
  <RefreshControl>
    <_NativeText
      style={_getDefaultTextStyle()}
      allowFontScaling={true}
      ellipsizeMode={'tail'}
      accessible={_getDefaultTextAccessible()}>
      not inline
    </_NativeText>
  </RefreshControl>
  <TextInput>
    <Text>inline input</Text>
  </TextInput>
  <TouchableWithoutFeedback>
    <Text>injected props</Text>
  </TouchableWithoutFeedback>
  <ScrollView StickyHeaderComponent={Unknown}>
    <Text>custom header</Text>
  </ScrollView>
</_NativeView>;
