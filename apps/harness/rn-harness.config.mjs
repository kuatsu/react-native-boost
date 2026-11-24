import { androidEmulator, androidPlatform } from '@react-native-harness/platform-android';
import { applePlatform, appleSimulator } from '@react-native-harness/platform-apple';

const androidDevice = process.env.HARNESS_ANDROID_AVD;

export default {
  entryPoint: './index.ts',
  appRegistryComponentName: 'main',
  // Transforms differ per mode, so each mode needs its own Metro cache.
  cache: { version: process.env.HARNESS_MODE ?? 'default' },
  runners: [
    applePlatform({
      name: 'ios',
      device: appleSimulator(
        process.env.HARNESS_IOS_DEVICE ?? 'iPhone 16 Pro',
        process.env.HARNESS_IOS_VERSION ?? '18.6'
      ),
      bundleId: 'com.kuatsu-mkrause.react-native-boost-harness',
    }),
    androidPlatform({
      name: 'android',
      // Harness can delete an AVD that does not match `avd`, so a named AVD must already run and gets none.
      device: androidDevice
        ? androidEmulator(androidDevice)
        : androidEmulator('Boost_Harness_API_35', {
            apiLevel: 35,
            profile: 'pixel_8',
            diskSize: '6G',
            heapSize: '1G',
          }),
      bundleId: 'com.kuatsumkrause.reactnativeboostharness',
    }),
  ],
};
