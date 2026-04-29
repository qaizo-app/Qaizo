const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// @react-native-firebase v24 on iOS needs specific ObjC pods to define modules
// so that Firebase Swift pods can import them. But:
//   - use_modular_headers! globally breaks gRPC-Core module map lookup
//   - use_frameworks! globally breaks RCTBridgeModule import order in RNFBFirestore
// Solution: apply :modular_headers => true ONLY to the ObjC pods Firebase Swift needs.
module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      // Remove anything injected by previous plugin versions
      podfile = podfile.replace(/\nuse_modular_headers!/g, '');
      podfile = podfile.replace(/\nuse_frameworks! :linkage => :static/g, '');

      if (!podfile.includes("pod 'GoogleUtilities'")) {
        const pods = [
          "  pod 'GoogleUtilities', :modular_headers => true",
          "  pod 'FirebaseCoreInternal', :modular_headers => true",
          "  pod 'FirebaseAuthInterop', :modular_headers => true",
          "  pod 'FirebaseAppCheckInterop', :modular_headers => true",
          "  pod 'RecaptchaInterop', :modular_headers => true",
          "  pod 'FirebaseFirestoreInternal', :modular_headers => true",
        ].join('\n');

        // Try to inject after use_expo_modules! (flexible indentation)
        if (/[ \t]+use_expo_modules!/.test(podfile)) {
          podfile = podfile.replace(
            /([ \t]+use_expo_modules!)/,
            `$1\n${pods}`
          );
        } else {
          // Fallback: inject inside target block
          podfile = podfile.replace(
            /^(target '[^']+' do\s*\n)/m,
            `$1${pods}\n`
          );
        }
      }

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};
