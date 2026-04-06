// plugins/withResizeableActivity.js
// Expo config plugin: добавляет resizeableActivity="true" для поддержки больших экранов
const { withAndroidManifest } = require('@expo/config-plugins');

function withResizeableActivity(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest.application?.[0];

    if (application) {
      application.$['android:resizeableActivity'] = 'true';
    }

    return config;
  });
}

module.exports = withResizeableActivity;
