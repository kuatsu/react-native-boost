const noop = () => {};

const API = new Proxy({}, { get: () => noop });

export default {
  API,
  assertNativeAnimatedModule: noop,
  generateNewAnimationId: () => 1,
  generateNewNodeTag: () => 1,
  nativeEventEmitter: { addListener: () => ({ remove: noop }) },
  shouldSignalBatch: false,
  shouldUseNativeDriver: () => false,
  transformDataType: (value: unknown) => value,
};
