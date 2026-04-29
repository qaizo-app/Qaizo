const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// @react-native-firebase v24 on iOS requires use_frameworks! :linkage => :static
// so that FirebaseAuth-Swift.h (generated Swift ObjC bridge header) is accessible
// at <FirebaseAuth/FirebaseAuth-Swift.h> inside the framework bundle.
//
// use_frameworks! causes Clang to enforce module imports strictly, which breaks
// RNFBFirestore: "RCTBridgeModule must be imported from module 'RNFBApp.RNFBAppModule'".
// Fix: set CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES for RNFB targets.
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

      // 1. Static frameworks — required for Swift ObjC bridge headers to be accessible
      podfile = podfile.replace(
        /^(platform :ios.+)$/m,
        '$1\nuse_frameworks! :linkage => :static'
      );

      // 2. Allow non-modular includes in RNFB framework modules.
      //    Fixes: "declaration of 'RCTBridgeModule' must be imported from module
      //    'RNFBApp.RNFBAppModule' before it is required"
      if (!podfile.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
        podfile += `
post_install do |installer|
  installer.pods_project.targets.each do |target|
    if target.name.start_with?('RNFB') || target.name == 'React-Core'
      target.build_configurations.each do |config|
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end
  end
end
`;
      }

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};
