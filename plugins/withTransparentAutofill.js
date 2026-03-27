// plugins/withTransparentAutofill.js
// Expo config plugin: убирает нативную подсветку автозаполнения на Android
const { withAndroidStyles } = require('@expo/config-plugins');

function withTransparentAutofill(config) {
  return withAndroidStyles(config, (config) => {
    const styles = config.modResults;

    // Находим AppTheme
    const appTheme = styles.resources.style.find(
      (s) => s.$.name === 'AppTheme'
    );

    if (appTheme) {
      // Убираем существующий autofilledHighlight если есть
      appTheme.item = (appTheme.item || []).filter(
        (i) => i.$.name !== 'android:autofilledHighlight'
      );
      // Добавляем прозрачный
      appTheme.item.push({
        $: { name: 'android:autofilledHighlight' },
        _: '@android:color/transparent',
      });
    }

    return config;
  });
}

module.exports = withTransparentAutofill;
