const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Firebase Swift pods need use_modular_headers! to define modules.
// But gRPC-Core/C++ (C libraries) break with it — disable only for them.
module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      // Clean up any previously injected lines
      podfile = podfile.replace(/\nuse_frameworks! :linkage => :static/g, '');
      podfile = podfile.replace(/\nuse_modular_headers!/g, '');

      // Global modular headers (required for Firebase Swift pods)
      podfile = podfile.replace(
        /^(platform :ios.+)$/m,
        '$1\nuse_modular_headers!'
      );

      // Disable modular headers for gRPC/C++ pods — they don't ship a module map
      // and use_modular_headers! causes gRPC-Core.modulemap-not-found at compile time
      const grpcPods = [
        "  pod 'gRPC-C++', :modular_headers => false",
        "  pod 'gRPC-Core', :modular_headers => false",
        "  pod 'BoringSSL-GRPC', :modular_headers => false",
        "  pod 'abseil', :modular_headers => false",
      ].join('\n');

      if (!podfile.includes("pod 'gRPC-C++'")) {
        podfile = podfile.replace(
          /(  use_expo_modules!)/,
          `$1\n${grpcPods}`
        );
      }

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};
