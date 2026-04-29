const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      // Clean up anything from previous plugin versions
      podfile = podfile.replace(/\nuse_modular_headers!/g, '');
      podfile = podfile.replace(/\nuse_frameworks! :linkage => :static/g, '');
      podfile = podfile.replace(/\$RNFirebaseAsStaticFramework = true\n\n/g, '');

      // Static frameworks: required for FirebaseAuth-Swift.h to be in framework Headers
      podfile = podfile.replace(
        /^(platform :ios.+)$/m,
        '$1\nuse_frameworks! :linkage => :static'
      );

      // Inject inside existing post_install block (multiple hooks are unsupported).
      // Finds closing ) of react_native_post_install(...) by paren-counting, injects after it.
      if (podfile.includes('react_native_post_install(') &&
          !podfile.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {

        const marker = 'react_native_post_install(';
        const markerIdx = podfile.indexOf(marker);
        const openParen = podfile.indexOf('(', markerIdx + marker.length - 1);

        let depth = 0;
        let closeIdx = openParen;
        for (let i = openParen; i < podfile.length; i++) {
          if (podfile[i] === '(') depth++;
          else if (podfile[i] === ')') {
            depth--;
            if (depth === 0) { closeIdx = i; break; }
          }
        }

        // Apply to ALL targets — fixes "RCTBridgeModule must be imported from
        // module RNFBApp.RNFBAppModule" when use_frameworks! enforces strict module imports.
        const fix = `
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        config.build_settings['OTHER_CFLAGS'] = '$(inherited) -Wno-non-modular-include-in-framework-module'
        if ['RNFBApp', 'RNFBAnalytics'].include?(target.name)
          config.build_settings['DEFINES_MODULE'] = 'NO'
        end
      end
    end`;

        podfile = podfile.slice(0, closeIdx + 1) + fix + podfile.slice(closeIdx + 1);
      }

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};
