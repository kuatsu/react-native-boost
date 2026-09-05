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
    <View>
      <Text>label</Text>
    </View>
  </Pressable>
);
const Pass = () => (
  <RefreshControl>
    <View>
      <Text>label</Text>
    </View>
  </RefreshControl>
);

<Text>
  <Pressable>
    <Text>pressable</Text>
  </Pressable>
  <TouchableOpacity>
    <Text>opacity</Text>
  </TouchableOpacity>
  <TouchableHighlight>
    <Text>highlight</Text>
  </TouchableHighlight>
  <KeyboardAvoidingView>
    <Text>keyboard</Text>
  </KeyboardAvoidingView>
  <ImageBackground>
    <Text>background</Text>
  </ImageBackground>
  <Modal>
    <Text>modal</Text>
  </Modal>
  <DrawerLayoutAndroid>
    <Text>drawer</Text>
  </DrawerLayoutAndroid>
  <Native.Pressable>
    <Text>namespace</Text>
  </Native.Pressable>
  <RefreshControl>
    <Text>still inline</Text>
  </RefreshControl>
</Text>;

<View>
  <RefreshControl>
    <Text>not inline</Text>
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
</View>;
