const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// @react-native-firebase v24 on iOS requires:
//   1. use_frameworks! :linkage => :static  — makes Swift pods expose their headers correctly
//   2. $RNFirebaseAsStaticFramework = true  — tells RNFB pods to configure for static frameworks,
//      which fixes the RCTBridgeModule module import order issue in RNFBFirestore/RNFBApp
module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      // Clean up anything injected by previous plugin versions
      podfile = podfile.replace(/\nuse_modular_headers!/g, '');
      podfile = podfile.replace(/\nuse_frameworks! :linkage => :static/g, '');
      podfile = podfile.replace(/\$RNFirebaseAsStaticFramework = true\n\n/g, '');

      // 1. Static frameworks (required for Swift pods to expose their ObjC bridging headers)
      podfile = podfile.replace(
        /^(platform :ios.+)$/m,
        '$1\nuse_frameworks! :linkage => :static'
      );

      // 2. Tell RNFB pods they're in static framework mode (fixes RCTBridgeModule import order)
      if (!podfile.includes('$RNFirebaseAsStaticFramework')) {
        podfile = podfile.replace(
          /^(target '[^']+' do)/m,
          '$RNFirebaseAsStaticFramework = true\n\n$1'
        );
      }

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};
