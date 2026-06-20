const { withAndroidManifest } = require('expo/config-plugins');

// Allows cleartext (HTTP) traffic on Android so the app can reach the local benchmark/dev server
// (http://10.0.2.2:<port> on an emulator, the host LAN IP on a device). API 28+ blocks cleartext by
// default and only the debug manifest overrides it, so release builds — which the benchmark suite uses
// — need this set explicitly. Safe here because this is a local example/benchmark app, not shipped.
module.exports = function withCleartextTraffic(config) {
  return withAndroidManifest(config, (modConfig) => {
    const application = modConfig.modResults.manifest.application?.[0];
    if (application) {
      application.$['android:usesCleartextTraffic'] = 'true';
    }
    return modConfig;
  });
};
