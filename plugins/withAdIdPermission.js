// plugins/withAdIdPermission.js
// Expo config plugin: declares com.google.android.gms.permission.AD_ID on
// the merged AndroidManifest.xml so Google Play stops failing the release
// with "AD_ID declared in console but missing from manifest".
//
// Earlier attempts:
// 1) android.permissions in app.json — Expo prebuild dropped it (Google
//    namespace not in the standard allowlist).
// 2) Hand-written withAndroidManifest pushing to uses-permission — built
//    fine but the permission was missing from the resulting AAB. The push
//    was being clobbered by prebuild's permission consolidation pass.
// Now using the canonical AndroidConfig.Permissions helper which Expo
// itself uses internally and guarantees survives the consolidation.
const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

const AD_ID = 'com.google.android.gms.permission.AD_ID';

function withAdIdPermission(config) {
  return withAndroidManifest(config, (config) => {
    AndroidConfig.Permissions.ensurePermission(config.modResults, AD_ID);
    return config;
  });
}

module.exports = withAdIdPermission;
