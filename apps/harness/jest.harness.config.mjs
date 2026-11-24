const mode = process.env.HARNESS_MODE ?? 'default';

export default {
  preset: 'react-native-harness',
  testMatch: ['<rootDir>/src/components.harness.tsx', `<rootDir>/src/${mode}.harness.tsx`],
};
