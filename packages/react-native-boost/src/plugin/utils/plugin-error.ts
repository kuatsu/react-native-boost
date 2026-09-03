export default class PluginError extends Error {
  constructor(message: string) {
    super(`[react-native-boost] ${message}`);
    this.name = 'PluginError';
  }
}
