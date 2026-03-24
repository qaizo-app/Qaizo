// src/screens/SettingsScreen.js
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Card from '../components/Card';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { colors } from '../theme/colors';
 
export default function SettingsScreen() {
  const [lang, setLang] = useState(i18n.getLanguage());
  const [, forceUpdate] = useState(0);
 
  const changeLang = (code) => {
    i18n.setLanguage(code);
    setLang(code);
    forceUpdate(n => n + 1);
  };
 
  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all transactions, accounts, and settings. Are you sure?',
      [
        { text: i18n.t('cancel'), style: 'cancel' },
        { text: i18n.t('delete'), style: 'destructive', onPress: async () => {
          await dataService.clearAllData();
          Alert.alert('Done', 'All data cleared');
        }},
      ]
    );
  };
 
  const handleExport = async () => {
    const data = await dataService.exportData();
    if (data) {
      Alert.alert('Export', `${data.transactions.length} transactions, ${data.accounts.length} accounts ready for export.\n\nFull export feature coming soon.`);
    }
  };
 
  const languages = i18n.getAvailableLanguages();
 
  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.header}>
          <Text style={styles.title}>⚙️ {i18n.t('language') === 'Язык' ? 'Настройки' : i18n.t('language') === 'שפה' ? 'הגדרות' : 'Settings'}</Text>
        </View>
 
        {/* Language */}
        <Text style={styles.sectionLabel}>{i18n.t('language')}</Text>
        <Card>
          {languages.map((l, idx) => (
            <TouchableOpacity
              key={l.code}
              style={[styles.optionRow, idx < languages.length - 1 && styles.optionBorder]}
              onPress={() => changeLang(l.code)}
            >
              <View style={styles.optionLeft}>
                <Text style={styles.optionEmoji}>
                  {l.code === 'ru' ? '🇷🇺' : l.code === 'he' ? '🇮🇱' : '🇬🇧'}
                </Text>
                <Text style={styles.optionText}>{l.name}</Text>
              </View>
              <View style={[styles.radio, lang === l.code && styles.radioActive]}>
                {lang === l.code && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
          ))}
        </Card>
 
        {/* Currency */}
        <Text style={styles.sectionLabel}>{i18n.t('currency')}</Text>
        <Card>
          {['₪ ILS', '$ USD', '€ EUR'].map((cur, idx) => (
            <TouchableOpacity key={cur} style={[styles.optionRow, idx < 2 && styles.optionBorder]}>
              <Text style={styles.optionText}>{cur}</Text>
              <View style={[styles.radio, idx === 0 && styles.radioActive]}>
                {idx === 0 && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
          ))}
        </Card>
 
        {/* Data */}
        <Text style={styles.sectionLabel}>
          {lang === 'ru' ? 'Данные' : lang === 'he' ? 'נתונים' : 'Data'}
        </Text>
        <Card>
          <TouchableOpacity style={[styles.optionRow, styles.optionBorder]} onPress={handleExport}>
            <View style={styles.optionLeft}>
              <Text style={styles.optionEmoji}>📤</Text>
              <Text style={styles.optionText}>{i18n.t('exportData')}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.optionRow, styles.optionBorder]}>
            <View style={styles.optionLeft}>
              <Text style={styles.optionEmoji}>📥</Text>
              <Text style={styles.optionText}>{i18n.t('importData')}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.optionRow} onPress={handleClearData}>
            <View style={styles.optionLeft}>
              <Text style={styles.optionEmoji}>🗑️</Text>
              <Text style={[styles.optionText, { color: colors.red }]}>{i18n.t('clearData')}</Text>
            </View>
            <Text style={[styles.arrow, { color: colors.red }]}>›</Text>
          </TouchableOpacity>
        </Card>
 
        {/* About */}
        <Text style={styles.sectionLabel}>{i18n.t('about')}</Text>
        <Card>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLogo}>
              <Text style={{ color: colors.green }}>Q</Text>aizo
            </Text>
            <Text style={styles.aboutVersion}>v1.0.0 MVP</Text>
          </View>
          <Text style={styles.aboutText}>
            AI-powered finance management{'\n'}Built for Israeli families
          </Text>
          <Text style={styles.aboutCopy}>© 2026 Qaizo</Text>
        </Card>
      </ScrollView>
    </View>
  );
}
 
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 8 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  sectionLabel: {
    color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 1,
    textTransform: 'uppercase', paddingHorizontal: 24, marginTop: 24, marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 16,
  },
  optionBorder: {
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  optionLeft: {
    flexDirection: 'row', alignItems: 'center',
  },
  optionEmoji: { fontSize: 20, marginRight: 12 },
  optionText: { color: colors.text, fontSize: 16, fontWeight: '500' },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    borderColor: colors.textMuted, justifyContent: 'center', alignItems: 'center',
  },
  radioActive: { borderColor: colors.green },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.green },
  arrow: { color: colors.textMuted, fontSize: 24, fontWeight: '300' },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  aboutLogo: { color: colors.text, fontSize: 22, fontWeight: '800' },
  aboutVersion: { color: colors.textMuted, fontSize: 12 },
  aboutText: { color: colors.textDim, fontSize: 14, lineHeight: 22, marginBottom: 12 },
  aboutCopy: { color: colors.textMuted, fontSize: 11 },
});