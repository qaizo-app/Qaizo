const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// @react-native-firebase v24 on iOS:
// - Global use_modular_headers! breaks gRPC-Core module map
// - Global use_frameworks! breaks RCTBridgeModule import order in RNFBFirestore
// Solution: apply :modular_headers => true ONLY to pods that actually need it:
//   - ObjC Firebase deps (so Firebase Swift pods can import them)
//   - FirebaseAuth + FirebaseCore (so RNFBApp can import FirebaseAuth-Swift.h)
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

      if (!podfile.includes("pod 'GoogleUtilities'")) {
        const pods = [
          // ObjC pods required by Firebase Swift modules
          "  pod 'GoogleUtilities', :modular_headers => true",
          "  pod 'FirebaseCoreInternal', :modular_headers => true",
          "  pod 'FirebaseAuthInterop', :modular_headers => true",
          "  pod 'FirebaseAppCheckInterop', :modular_headers => true",
          "  pod 'RecaptchaInterop', :modular_headers => true",
          "  pod 'FirebaseFirestoreInternal', :modular_headers => true",
          // Swift pods — modular_headers enables Swift ObjC bridge header generation
          // so RNFBApp can import <FirebaseAuth/FirebaseAuth-Swift.h>
          "  pod 'FirebaseAuth', :modular_headers => true",
          "  pod 'FirebaseCore', :modular_headers => true",
        ].join('\n');

        if (/[ \t]+use_expo_modules!/.test(podfile)) {
          podfile = podfile.replace(
            /([ \t]+use_expo_modules!)/,
            `$1\n${pods}`
          );
        } else {
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
