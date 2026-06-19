const { withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

const MARKER = '-disable-autolink-framework';
const ANCHOR = 'post_install do |installer|';

// Injected into the generated Podfile's post_install hook. Xcode 26's linker
// refuses to let the Debug build's app dylib (RNBoost.debug.dylib) link
// SwiftUICore directly, because the dylib is not in SwiftUICore's
// allowable_clients list. `import SwiftUI` (in RN core's RCTSwiftUI pod) emits an
// implicit SwiftUICore autolink that triggers this. Dropping that autolink lets
// the symbols resolve through the public SwiftUI framework's re-export instead.
const INJECTION = [
  '',
  '    installer.pods_project.targets.each do |target|',
  '      target.build_configurations.each do |build_config|',
  "        existing = build_config.build_settings['OTHER_SWIFT_FLAGS'] || '$(inherited)'",
  "        existing = existing.join(' ') if existing.is_a?(Array)",
  `        next if existing.include?('${MARKER}')`,
  "        build_config.build_settings['OTHER_SWIFT_FLAGS'] =",
  '          "#{existing} -Xfrontend -disable-autolink-framework -Xfrontend SwiftUICore"',
  '      end',
  '    end',
].join('\n');

function patchPodfile(contents) {
  if (contents.includes(MARKER)) {
    return contents;
  }
  if (!contents.includes(ANCHOR)) {
    throw new Error(
      `with-swiftuicore-debug-link-fix: could not find "${ANCHOR}" in the Podfile; the SwiftUICore autolink workaround was not applied.`
    );
  }
  return contents.replace(`${ANCHOR}\n`, `${ANCHOR}\n${INJECTION}\n`);
}

module.exports = function withSwiftUICoreDebugLinkFix(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(podfilePath, 'utf8');
      fs.writeFileSync(podfilePath, patchPodfile(contents));
      return cfg;
    },
  ]);
};

module.exports.patchPodfile = patchPodfile;
