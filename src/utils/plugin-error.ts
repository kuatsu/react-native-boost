export default class PluginError extends Error {
  constructor(message: string) {
    super(`[react-native-boost] Babel plugin exception: ${message}`);
    this.name = 'PluginError';
  }
}
