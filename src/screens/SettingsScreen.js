// src/screens/SettingsScreen.js
// Добавлена кнопка Категории → открывает CategoriesScreen
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Card from '../components/Card';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { colors } from '../theme/colors';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const [lang, setLang] = useState(i18n.getLanguage());
  const [openSection, setOpenSection] = useState(null);
  const [, forceUpdate] = useState(0);

  const toggle = (s) => setOpenSection(openSection === s ? null : s);
  const changeLang = (code) => { i18n.setLanguage(code); setLang(code); forceUpdate(n => n + 1); };

  const handleClearData = () => {
    Alert.alert('', lang === 'ru' ? 'Удалить все данные?' : 'Delete all data?', [
      { text: i18n.t('cancel'), style: 'cancel' },
      { text: i18n.t('delete'), style: 'destructive', onPress: async () => { await dataService.clearAllData(); Alert.alert('', 'Done'); }},
    ]);
  };
  const handleRecalc = async () => {
    await dataService.recalculateBalances();
    Alert.alert('', lang === 'ru' ? 'Балансы пересчитаны' : 'Balances recalculated');
  };
  const handleExport = async () => {
    const data = await dataService.exportData();
    if (data) Alert.alert('', `${data.transactions.length} transactions, ${data.accounts.length} accounts`);
  };

  const flags = { ru: '🇷🇺', he: '🇮🇱', en: '🇬🇧' };
  const languages = i18n.getAvailableLanguages();
  const settingsTitle = lang === 'ru' ? 'Настройки' : lang === 'he' ? 'הגדרות' : 'Settings';

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.header}>
          <Text style={styles.title}>⚙️ {settingsTitle}</Text>
        </View>

        {/* Categories */}
        <TouchableOpacity style={styles.sectionBtn} onPress={() => navigation.navigate('Categories')}>
          <View style={styles.sectionLeft}>
            <Feather name="grid" size={18} color={colors.teal} />
            <Text style={styles.sectionText}>{lang === 'ru' ? 'Категории' : lang === 'he' ? 'קטגוריות' : 'Categories'}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Language */}
        <TouchableOpacity style={styles.sectionBtn} onPress={() => toggle('lang')}>
          <View style={styles.sectionLeft}>
            <Feather name="globe" size={18} color={colors.green} />
            <Text style={styles.sectionText}>{i18n.t('language')}</Text>
          </View>
          <View style={styles.sectionRight}>
            <Text style={styles.sectionValue}>{flags[lang]} {lang.toUpperCase()}</Text>
            <Feather name={openSection === 'lang' ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
          </View>
        </TouchableOpacity>
        {openSection === 'lang' && (
          <Card>
            {languages.map((l, idx) => (
              <TouchableOpacity key={l.code} style={[styles.optRow, idx < languages.length - 1 && styles.optBorder]} onPress={() => changeLang(l.code)}>
                <Text style={styles.optEmoji}>{flags[l.code]}</Text>
                <Text style={styles.optText}>{l.name}</Text>
                <View style={[styles.radio, lang === l.code && styles.radioOn]}>
                  {lang === l.code && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            ))}
          </Card>
        )}

        {/* Currency */}
        <TouchableOpacity style={styles.sectionBtn} onPress={() => toggle('cur')}>
          <View style={styles.sectionLeft}>
            <Feather name="dollar-sign" size={18} color={colors.blue} />
            <Text style={styles.sectionText}>{i18n.t('currency')}</Text>
          </View>
          <View style={styles.sectionRight}>
            <Text style={styles.sectionValue}>₪ ILS</Text>
            <Feather name={openSection === 'cur' ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
          </View>
        </TouchableOpacity>
        {openSection === 'cur' && (
          <Card>
            {['₪ ILS', '$ USD', '€ EUR'].map((cur, idx) => (
              <TouchableOpacity key={cur} style={[styles.optRow, idx < 2 && styles.optBorder]}>
                <Text style={styles.optText}>{cur}</Text>
                <View style={[styles.radio, idx === 0 && styles.radioOn]}>
                  {idx === 0 && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            ))}
          </Card>
        )}

        {/* Data */}
        <TouchableOpacity style={styles.sectionBtn} onPress={() => toggle('data')}>
          <View style={styles.sectionLeft}>
            <Feather name="database" size={18} color={colors.orange} />
            <Text style={styles.sectionText}>{lang === 'ru' ? 'Данные' : lang === 'he' ? 'נתונים' : 'Data'}</Text>
          </View>
          <Feather name={openSection === 'data' ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
        </TouchableOpacity>
        {openSection === 'data' && (
          <Card>
            <TouchableOpacity style={[styles.optRow, styles.optBorder]} onPress={handleExport}>
              <Feather name="upload" size={18} color={colors.textDim} style={{ marginRight: 12 }} />
              <Text style={styles.optText}>{i18n.t('exportData')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optRow, styles.optBorder]}>
              <Feather name="download" size={18} color={colors.textDim} style={{ marginRight: 12 }} />
              <Text style={styles.optText}>{i18n.t('importData')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optRow, styles.optBorder]} onPress={handleRecalc}>
              <Feather name="refresh-cw" size={18} color={colors.blue} style={{ marginRight: 12 }} />
              <Text style={styles.optText}>{lang === 'ru' ? 'Пересчитать балансы' : 'Recalculate balances'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optRow} onPress={handleClearData}>
              <Feather name="trash-2" size={18} color={colors.red} style={{ marginRight: 12 }} />
              <Text style={[styles.optText, { color: colors.red }]}>{i18n.t('clearData')}</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* About */}
        <View style={{ marginTop: 24 }}>
          <Card>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLogo}><Text style={{ color: colors.green }}>Q</Text>aizo</Text>
              <Text style={styles.aboutVer}>v1.0.0 MVP</Text>
            </View>
            <Text style={styles.aboutText}>AI-powered finance management{'\n'}Built for Israeli families</Text>
            <Text style={styles.aboutCopy}>© 2026 Qaizo</Text>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 8 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },

  sectionBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 20, marginTop: 12, backgroundColor: colors.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: colors.cardBorder },
  sectionLeft: { flexDirection: 'row', alignItems: 'center' },
  sectionText: { color: colors.text, fontSize: 16, fontWeight: '600', marginLeft: 12 },
  sectionRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionValue: { color: colors.textDim, fontSize: 14, fontWeight: '500' },

  optRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  optBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  optEmoji: { fontSize: 22, marginRight: 14 },
  optText: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '500' },

  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.textMuted, justifyContent: 'center', alignItems: 'center' },
  radioOn: { borderColor: colors.green },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.green },

  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  aboutLogo: { color: colors.text, fontSize: 22, fontWeight: '800' },
  aboutVer: { color: colors.textMuted, fontSize: 12 },
  aboutText: { color: colors.textDim, fontSize: 14, lineHeight: 22, marginBottom: 12 },
  aboutCopy: { color: colors.textMuted, fontSize: 11 },
});