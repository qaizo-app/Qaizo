// plugins/withAdIdPermission.js
// Expo config plugin: declares com.google.android.gms.permission.AD_ID on
// the merged AndroidManifest.xml so Google Play stops failing the release
// with "AD_ID declared in console but missing from manifest".
//
// We tried listing the permission in app.json `android.permissions` first,
// but Expo prebuild silently drops Google-namespace permissions there.
// Touching the manifest directly is the only reliable path.
const { withAndroidManifest } = require('@expo/config-plugins');

const AD_ID = 'com.google.android.gms.permission.AD_ID';

function withAdIdPermission(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest['uses-permission']) manifest['uses-permission'] = [];
    const already = manifest['uses-permission'].some(
      (p) => p.$ && p.$['android:name'] === AD_ID
    );
    if (!already) {
      manifest['uses-permission'].push({ $: { 'android:name': AD_ID } });
    }
    return config;
  });
}

module.exports = withAdIdPermission;
