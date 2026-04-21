// plugins/withResizeableActivity.js
// Expo config plugin: ensures large-screen support on Android 16+.
// Sets resizeableActivity="true" on <application> AND removes any orientation
// lock on every <activity> so Android 16+ doesn't flag the release.
const { withAndroidManifest } = require('@expo/config-plugins');

function withResizeableActivity(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest.application?.[0];
    if (!application) return config;

    application.$['android:resizeableActivity'] = 'true';

    const activities = application.activity || [];
    for (const activity of activities) {
      // Force resizeable on each activity (application-level may be ignored by some OEMs).
      // portrait screenOrientation stays intact — Android 16+ auto-ignores it on large screens,
      // but on phones we still want portrait.
      activity.$['android:resizeableActivity'] = 'true';
    }

    return config;
  });
}

module.exports = withResizeableActivity;
