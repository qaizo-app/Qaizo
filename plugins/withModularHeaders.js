const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Firebase + gRPC require static frameworks on iOS.
// use_modular_headers! alone breaks gRPC-Core.modulemap lookup.
module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      // Remove any previously injected use_modular_headers!
      podfile = podfile.replace(/\nuse_modular_headers!/g, '');

      // Static frameworks: fixes Firebase Swift pods AND gRPC module maps
      if (!podfile.includes('use_frameworks!')) {
        podfile = podfile.replace(
          /^(platform :ios.+)$/m,
          '$1\nuse_frameworks! :linkage => :static'
        );
      }

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};
