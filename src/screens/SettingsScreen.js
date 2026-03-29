// src/screens/SettingsScreen.js
// Добавлена кнопка Категории → открывает CategoriesScreen
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Card from '../components/Card';
import ConfirmModal from '../components/ConfirmModal';
import ExportModal from '../components/ExportModal';
import ImportModal from '../components/ImportModal';
import i18n from '../i18n';
import authService from '../services/authService';
import dataService from '../services/dataService';
import { useToast } from '../components/ToastProvider';
import { colors } from '../theme/colors';
import { CURRENCIES, setCurrency, sym } from '../utils/currency';
import { useTheme } from '../theme/ThemeContext';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { themeMode, setThemeMode } = useTheme();
  const [lang, setLang] = useState(i18n.getLanguage());
  const [weekStart, setWeekStart] = useState('sunday');
  const [curSymbol, setCurSymbol] = useState(sym());
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [openSection, setOpenSection] = useState(null);
  const [langVersion, setLangVersion] = useState(0);
  const currentUser = authService.getCurrentUser();
  const toast = useToast();
  const styles = createStyles();

  // Загрузить weekStart из настроек
  useEffect(() => {
    dataService.getSettings().then(s => { if (s.weekStart) setWeekStart(s.weekStart); });
  }, []);

  const toggle = (s) => setOpenSection(openSection === s ? null : s);

  const changeCurrency = async (cur) => {
    setCurrency(cur.symbol, cur.code);
    setCurSymbol(cur.symbol);
    setOpenSection(null);
    const settings = await dataService.getSettings();
    await dataService.saveSettings({ ...settings, currency: cur.symbol });
  };

  const changeWeekStart = async (day) => {
    setWeekStart(day);
    setOpenSection(null);
    const settings = await dataService.getSettings();
    await dataService.saveSettings({ ...settings, weekStart: day });
  };
  const changeLang = async (code) => {
    const rtlChanged = i18n.setLanguage(code);
    setLang(code);
    setOpenSection(null);
    setLangVersion(n => n + 1);

    // Сохраняем язык + ставим флаг ручного выбора
    const settings = await dataService.getSettings();
    await dataService.saveSettings({ ...settings, language: code });
    await AsyncStorage.setItem('qaizo_lang_manual', 'true');

    if (rtlChanged) {
      Alert.alert('', i18n.t('langChanged'));
    }
  };

  const [showClearData, setShowClearData] = useState(false);
  const handleClearDataConfirm = async () => {
    await dataService.clearAllData();
    setShowClearData(false);
    toast.show(i18n.t('dataCleared'), 'success');
  };
  const handleRecalc = async () => {
    await dataService.recalculateBalances();
    toast.show(i18n.t('balancesRecalculated'), 'success');
  };
  const handleExportResult = (result) => {
    if (result === 'success') toast.show(i18n.t('exported'), 'success');
    else if (result === 'noData') toast.show(i18n.t('noDataForExport'), 'warning');
    else toast.show(i18n.t('errorOccurred'), 'error');
  };

  const flags = { ru: '🇷🇺', he: '🇮🇱', en: '🇬🇧' };
  const languages = i18n.getAvailableLanguages();
  const settingsTitle = i18n.t('settings');

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.header}>
          <Text style={styles.title}>⚙️ {settingsTitle}</Text>
        </View>

        {/* AI Advisor */}
        <TouchableOpacity style={styles.sectionBtn} onPress={() => navigation.navigate('AIAdvisor')}>
          <View style={styles.sectionLeft}>
            <Feather name="cpu" size={18} color={colors.green} />
            <Text style={styles.sectionText}>{i18n.t('advisor')}</Text>
          </View>
          <Feather name={i18n.isRTL() ? 'chevron-left' : 'chevron-right'} size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* AI Chat */}
        <TouchableOpacity style={styles.sectionBtn} onPress={() => navigation.navigate('AIChat')}>
          <View style={styles.sectionLeft}>
            <Feather name="message-circle" size={18} color={colors.green} />
            <Text style={styles.sectionText}>{i18n.t('aiChat')}</Text>
          </View>
          <Feather name={i18n.isRTL() ? 'chevron-left' : 'chevron-right'} size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Investments */}
        <TouchableOpacity style={styles.sectionBtn} onPress={() => navigation.navigate('Investments')}>
          <View style={styles.sectionLeft}>
            <Feather name="trending-up" size={18} color={colors.teal} />
            <Text style={styles.sectionText}>{i18n.t('investments')}</Text>
          </View>
          <Feather name={i18n.isRTL() ? 'chevron-left' : 'chevron-right'} size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Categories */}
        <TouchableOpacity style={styles.sectionBtn} onPress={() => navigation.navigate('Categories')}>
          <View style={styles.sectionLeft}>
            <Feather name="grid" size={18} color={colors.teal} />
            <Text style={styles.sectionText}>{i18n.t('categories')}</Text>
          </View>
          <Feather name={i18n.isRTL() ? 'chevron-left' : 'chevron-right'} size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Monthly Report */}
        <TouchableOpacity style={styles.sectionBtn} onPress={() => navigation.navigate('MonthlyReport')}>
          <View style={styles.sectionLeft}>
            <Feather name="file-text" size={18} color={colors.blue} />
            <Text style={styles.sectionText}>{i18n.t('monthlyReport')}</Text>
          </View>
          <Feather name={i18n.isRTL() ? 'chevron-left' : 'chevron-right'} size={18} color={colors.textMuted} />
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

        {/* Theme */}
        <TouchableOpacity style={styles.sectionBtn} onPress={() => toggle('theme')}>
          <View style={styles.sectionLeft}>
            <Feather name={themeMode === 'dark' ? 'moon' : themeMode === 'light' ? 'sun' : 'smartphone'} size={18} color={colors.yellow} />
            <Text style={styles.sectionText}>{i18n.t('theme')}</Text>
          </View>
          <View style={styles.sectionRight}>
            <Text style={styles.sectionValue}>
              {themeMode === 'system' ? i18n.t('themeSystem') : themeMode === 'light' ? i18n.t('themeLight') : i18n.t('themeDark')}
            </Text>
            <Feather name={openSection === 'theme' ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
          </View>
        </TouchableOpacity>
        {openSection === 'theme' && (
          <Card>
            {[
              { mode: 'system', icon: 'smartphone', label: i18n.t('themeSystem') },
              { mode: 'light', icon: 'sun', label: i18n.t('themeLight') },
              { mode: 'dark', icon: 'moon', label: i18n.t('themeDark') },
            ].map((opt, idx) => (
              <TouchableOpacity key={opt.mode} style={[styles.optRow, idx < 2 && styles.optBorder]}
                onPress={() => { setThemeMode(opt.mode); setOpenSection(null); }}>
                <Feather name={opt.icon} size={18} color={colors.textDim} style={{ }} />
                <Text style={styles.optText}>{opt.label}</Text>
                <View style={[styles.radio, themeMode === opt.mode && styles.radioOn]}>
                  {themeMode === opt.mode && <View style={styles.radioDot} />}
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
            <Text style={styles.sectionValue}>{curSymbol} {CURRENCIES.find(c => c.symbol === curSymbol)?.code}</Text>
            <Feather name={openSection === 'cur' ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
          </View>
        </TouchableOpacity>
        {openSection === 'cur' && (
          <Card>
            {CURRENCIES.map((cur, idx) => (
              <TouchableOpacity key={cur.code} style={[styles.optRow, idx < CURRENCIES.length - 1 && styles.optBorder]}
                onPress={() => changeCurrency(cur)}>
                <Text style={styles.optText}>{cur.symbol} {cur.code}</Text>
                <View style={[styles.radio, curSymbol === cur.symbol && styles.radioOn]}>
                  {curSymbol === cur.symbol && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            ))}
          </Card>
        )}

        {/* Week Start */}
        <TouchableOpacity style={styles.sectionBtn} onPress={() => toggle('week')}>
          <View style={styles.sectionLeft}>
            <Feather name="calendar" size={18} color={colors.teal} />
            <Text style={styles.sectionText}>{i18n.t('weekStart')}</Text>
          </View>
          <View style={styles.sectionRight}>
            <Text style={styles.sectionValue}>{i18n.t(weekStart)}</Text>
            <Feather name={openSection === 'week' ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
          </View>
        </TouchableOpacity>
        {openSection === 'week' && (
          <Card>
            {['sunday', 'monday', 'saturday'].map((day, idx) => (
              <TouchableOpacity key={day} style={[styles.optRow, idx < 2 && styles.optBorder]}
                onPress={() => changeWeekStart(day)}>
                <Text style={styles.optText}>{i18n.t(day)}</Text>
                <View style={[styles.radio, weekStart === day && styles.radioOn]}>
                  {weekStart === day && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            ))}
          </Card>
        )}

        {/* Data */}
        <TouchableOpacity style={styles.sectionBtn} onPress={() => toggle('data')}>
          <View style={styles.sectionLeft}>
            <Feather name="database" size={18} color={colors.orange} />
            <Text style={styles.sectionText}>{i18n.t('data')}</Text>
          </View>
          <Feather name={openSection === 'data' ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
        </TouchableOpacity>
        {openSection === 'data' && (
          <Card>
            <TouchableOpacity style={[styles.optRow, styles.optBorder]} onPress={() => { setOpenSection(null); setShowExport(true); }}>
              <Feather name="upload" size={18} color={colors.green} style={{ }} />
              <Text style={styles.optText}>{i18n.t('exportData')}</Text>
              <Text style={styles.sectionValue}>CSV / Excel / PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optRow, styles.optBorder]} onPress={() => { setOpenSection(null); setShowImport(true); }}>
              <Feather name="download" size={18} color={colors.blue} style={{ }} />
              <Text style={styles.optText}>{i18n.t('importData')}</Text>
              <Text style={styles.sectionValue}>CSV / Excel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optRow, styles.optBorder]} onPress={handleRecalc}>
              <Feather name="refresh-cw" size={18} color={colors.blue} style={{ }} />
              <Text style={styles.optText}>{i18n.t('recalculate')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optRow} onPress={() => setShowClearData(true)}>
              <Feather name="trash-2" size={18} color={colors.red} style={{ }} />
              <Text style={[styles.optText, { color: colors.red }]}>{i18n.t('clearData')}</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Account */}
        <TouchableOpacity style={styles.sectionBtn} onPress={() => toggle('account')}>
          <View style={styles.sectionLeft}>
            <Feather name="user" size={18} color={currentUser ? colors.green : colors.textMuted} />
            <Text style={styles.sectionText}>{currentUser ? (currentUser.displayName || currentUser.email) : i18n.t('loginOrRegister')}</Text>
          </View>
          <Feather name={openSection === 'account' ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
        </TouchableOpacity>
        {openSection === 'account' && (
          <Card>
            {currentUser ? (
              <>
                <View style={[styles.optRow, styles.optBorder]}>
                  <Feather name="mail" size={16} color={colors.textDim} />
                  <Text style={styles.optText}>{currentUser.email}</Text>
                </View>
                <TouchableOpacity style={[styles.optRow, styles.optBorder]} onPress={async () => {
                  await authService.logout();
                  setOpenSection(null);
                  setLangVersion(n => n + 1);
                }}>
                  <Feather name="log-out" size={16} color={colors.red} />
                  <Text style={[styles.optText, { color: colors.red }]}>{i18n.t('logout')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.optRow} onPress={() => setShowDeleteAccount(true)}>
                  <Feather name="user-x" size={16} color={colors.red} />
                  <Text style={[styles.optText, { color: colors.red }]}>{i18n.t('deleteAccount')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.optRow} onPress={() => {
                AsyncStorage.removeItem('qaizo_auth_skipped');
                import('expo-updates').then(({ reloadAsync }) => {
                  reloadAsync?.().catch(() => Alert.alert('', i18n.t('restartApp')));
                }).catch(() => Alert.alert('', i18n.t('restartApp')));
              }}>
                <Feather name="log-in" size={16} color={colors.green} />
                <Text style={[styles.optText, { color: colors.green }]}>{i18n.t('loginOrRegister')}</Text>
              </TouchableOpacity>
            )}
          </Card>
        )}

        {/* About */}
        <TouchableOpacity style={styles.sectionBtn} onPress={() => toggle('about')}>
          <View style={styles.sectionLeft}>
            <Feather name="info" size={18} color={colors.textDim} />
            <Text style={styles.sectionText}>Qaizo</Text>
          </View>
          <View style={styles.sectionRight}>
            <Text style={styles.sectionValue}>v1.0.0</Text>
            <Feather name={openSection === 'about' ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
          </View>
        </TouchableOpacity>
        {openSection === 'about' && (
          <Card>
            <Text style={styles.aboutText}>{i18n.t('aboutText')}</Text>
            <Text style={styles.aboutCopy}>© 2026 Qaizo</Text>
          </Card>
        )}
      </ScrollView>

      <ExportModal visible={showExport} onClose={() => setShowExport(false)} onResult={handleExportResult} />
      <ImportModal visible={showImport} onClose={() => setShowImport(false)} onImported={() => toast.show(i18n.t('importDone'), 'success')} />

      <ConfirmModal visible={showClearData}
        title={i18n.t('clearData')} message={i18n.t('deleteAllData')}
        confirmText={i18n.t('delete')} cancelText={i18n.t('cancel')}
        onConfirm={handleClearDataConfirm} onCancel={() => setShowClearData(false)}
        icon="trash-2" />

      <ConfirmModal visible={showDeleteAccount}
        title={i18n.t('deleteAccount')} message={i18n.t('deleteAccountConfirm')}
        confirmText={i18n.t('delete')} cancelText={i18n.t('cancel')}
        onConfirm={async () => {
          await dataService.clearAllData();
          await authService.logout();
          setShowDeleteAccount(false);
          toast.show(i18n.t('accountDeleted'), 'success');
        }}
        onCancel={() => setShowDeleteAccount(false)}
        icon="user-x" />
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 8 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', textAlign: i18n.textAlign() },

  sectionBtn: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 20, marginTop: 12, backgroundColor: colors.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: colors.cardBorder },
  sectionLeft: { flexDirection: i18n.row(), alignItems: 'center', gap: 12 },
  sectionText: { color: colors.text, fontSize: 16, fontWeight: '600', textAlign: i18n.textAlign() },
  sectionRight: { flexDirection: i18n.row(), alignItems: 'center', gap: 8 },
  sectionValue: { color: colors.textDim, fontSize: 14, fontWeight: '500' },

  optRow: { flexDirection: i18n.row(), alignItems: 'center', paddingVertical: 16, gap: 12 },
  optBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  optEmoji: { fontSize: 22 },
  optText: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '500', textAlign: i18n.textAlign() },

  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.textMuted, justifyContent: 'center', alignItems: 'center' },
  radioOn: { borderColor: colors.green },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.green },

  aboutRow: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  aboutLogo: { color: colors.text, fontSize: 22, fontWeight: '800' },
  aboutVer: { color: colors.textMuted, fontSize: 12 },
  aboutText: { color: colors.textDim, fontSize: 14, lineHeight: 22, marginBottom: 12 },
  aboutCopy: { color: colors.textMuted, fontSize: 11 },

  // Account
  userRow: { flexDirection: i18n.row(), alignItems: 'center', marginBottom: 16 },
  avatarWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.greenSoft, justifyContent: 'center', alignItems: 'center', marginEnd: 14 },
  userName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  userEmail: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  logoutBtn: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.redSoft },
  logoutTxt: { color: colors.red, fontSize: 14, fontWeight: '600' },
  deleteAccountBtn: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  deleteAccountTxt: { color: colors.red, fontSize: 13, fontWeight: '500' },
  loginBtn: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  loginTxt: { color: colors.green, fontSize: 16, fontWeight: '700' },
});