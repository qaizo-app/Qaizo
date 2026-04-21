// src/screens/SettingsScreen.js
// Добавлена кнопка Категории → открывает CategoriesScreen
import { Feather } from '@expo/vector-icons';
let Sentry = null;
try { Sentry = require('@sentry/react-native'); } catch (e) {}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Card from '../components/Card';
import ConfirmModal from '../components/ConfirmModal';
import CurrencyPickerModal from '../components/CurrencyPickerModal';
import PinScreen from './PinScreen';
import ExportModal from '../components/ExportModal';
import ImportModal from '../components/ImportModal';
import i18n from '../i18n';
import authService from '../services/authService';
import dataService from '../services/dataService';
import securityService from '../services/securityService';
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
  const [monthlyExtra, setMonthlyExtra] = useState('');
  const [langVersion, setLangVersion] = useState(0);
  const currentUser = authService.getCurrentUser();
  const toast = useToast();
  const versionTapCount = useRef(0);
  const versionTapTimer = useRef(null);
  const styles = createStyles();

  // Загрузить weekStart + PIN status
  useEffect(() => {
    dataService.getSettings().then(s => {
      if (s.weekStart) setWeekStart(s.weekStart);
      if (s.monthlyExtra) setMonthlyExtra(String(s.monthlyExtra));
    });
    securityService.isPinEnabled().then(setPinEnabled);
    securityService.isBiometricEnabled().then(setBioEnabled);
    securityService.isBiometricAvailable().then(setBioAvailable);
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
    const willChangeRTL = (code === 'he') !== (lang === 'he');

    // Сохраняем СНАЧАЛА
    await AsyncStorage.setItem('qaizo_lang_manual', 'true');
    await AsyncStorage.setItem('qaizo_lang_code', code);
    const settings = await dataService.getSettings();
    await dataService.saveSettings({ ...settings, language: code });

    if (willChangeRTL) {
      // Показать модал на ТЕКУЩЕМ языке, язык сменится после перезапуска
      setOpenSection(null);
      setShowLangRestart(true);
    } else {
      i18n.setLanguage(code);
      setLang(code);
      setOpenSection(null);
      setLangVersion(n => n + 1);
    }
  };

  const [pinEnabled, setPinEnabled] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [showPinModal, setShowPinModal] = useState(null); // 'setup' | 'remove' | null
  const [showClearData, setShowClearData] = useState(false);
  const [showLangRestart, setShowLangRestart] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
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
      <ScrollView showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name={i18n.backIcon()} size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{settingsTitle}</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* ═══ TOOLS ═══ */}
        <Text style={styles.groupTitle}>{i18n.t('settingsTools')}</Text>

        <TouchableOpacity style={styles.sectionBtn} onPress={() => navigation.navigate('Categories')}>
          <View style={styles.sectionLeft}>
            <Feather name="grid" size={18} color={colors.teal} />
            <Text style={styles.sectionText}>{i18n.t('categories')}</Text>
          </View>
          <Feather name={i18n.chevronRight()} size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.sectionBtn} onPress={() => navigation.navigate('Projects')}>
          <View style={styles.sectionLeft}>
            <Feather name="folder" size={18} color="#a78bfa" />
            <Text style={styles.sectionText}>{i18n.t('projects')}</Text>
          </View>
          <Feather name={i18n.chevronRight()} size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.sectionBtn} onPress={() => navigation.navigate('Goals')}>
          <View style={styles.sectionLeft}>
            <Feather name="target" size={18} color="#f59e0b" />
            <Text style={styles.sectionText}>{i18n.t('goals')}</Text>
          </View>
          <Feather name={i18n.chevronRight()} size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.sectionBtn} onPress={() => navigation.navigate('Investments')}>
          <View style={styles.sectionLeft}>
            <Feather name="trending-up" size={18} color={colors.teal} />
            <Text style={styles.sectionText}>{i18n.t('investments')}</Text>
          </View>
          <Feather name={i18n.chevronRight()} size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.sectionBtn} onPress={() => navigation.navigate('ShoppingList')}>
          <View style={styles.sectionLeft}>
            <Feather name="shopping-cart" size={18} color="#f472b6" />
            <Text style={styles.sectionText}>{i18n.t('shoppingList')}</Text>
          </View>
          <Feather name={i18n.chevronRight()} size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.sectionBtn} onPress={() => navigation.navigate('Analytics')}>
          <View style={styles.sectionLeft}>
            <Feather name="bar-chart-2" size={18} color="#22d3ee" />
            <Text style={styles.sectionText}>{i18n.t('analytics')}</Text>
          </View>
          <Feather name={i18n.chevronRight()} size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.sectionBtn} onPress={() => navigation.navigate('MonthlyReport')}>
          <View style={styles.sectionLeft}>
            <Feather name="file-text" size={18} color={colors.blue} />
            <Text style={styles.sectionText}>{i18n.t('monthlyReport')}</Text>
          </View>
          <Feather name={i18n.chevronRight()} size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* ═══ PREFERENCES ═══ */}
        <Text style={styles.groupTitle}>{i18n.t('settingsPreferences')}</Text>

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
            <Feather name={themeMode === 'dark' ? 'moon' : themeMode === 'light' ? 'sun' : themeMode === 'amoled' ? 'circle' : 'smartphone'} size={18} color={colors.yellow} />
            <Text style={styles.sectionText}>{i18n.t('theme')}</Text>
          </View>
          <View style={styles.sectionRight}>
            <Text style={styles.sectionValue}>
              {themeMode === 'system' ? i18n.t('themeSystem')
                : themeMode === 'light' ? i18n.t('themeLight')
                : themeMode === 'amoled' ? i18n.t('themeAmoled')
                : i18n.t('themeDark')}
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
              { mode: 'amoled', icon: 'circle', label: i18n.t('themeAmoled') },
            ].map((opt, idx, arr) => (
              <TouchableOpacity key={opt.mode} style={[styles.optRow, idx < arr.length - 1 && styles.optBorder]}
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

        {/* Monthly Extra */}
        <TouchableOpacity style={styles.sectionBtn} onPress={() => toggle('extra')}>
          <View style={styles.sectionLeft}>
            <Feather name="plus-circle" size={18} color={colors.green} />
            <Text style={styles.sectionText}>{i18n.t('monthlyExtra')}</Text>
          </View>
          <View style={styles.sectionRight}>
            <Text style={styles.sectionValue}>{monthlyExtra ? `${monthlyExtra} ${sym()}` : '—'}</Text>
            <Feather name={openSection === 'extra' ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
          </View>
        </TouchableOpacity>
        {openSection === 'extra' && (
          <Card>
            <Text style={{ color: colors.textDim, fontSize: 12, marginBottom: 10 }}>{i18n.t('monthlyExtraHint')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TextInput style={[styles.extraInput, { flex: 1 }]} value={String(monthlyExtra || '')} onChangeText={setMonthlyExtra}
                keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textMuted} />
              <TouchableOpacity style={styles.extraSaveBtn} onPress={async () => {
                const settings = await dataService.getSettings();
                await dataService.saveSettings({ ...settings, monthlyExtra: parseFloat((monthlyExtra||'').replace(',', '.')) || 0 });
                setOpenSection(null);
                toast.show(i18n.t('saved'), 'success');
              }}>
                <Feather name="check" size={18} color={colors.bg} />
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* ═══ DATA & SECURITY ═══ */}
        <Text style={styles.groupTitle}>{i18n.t('settingsDataSection')}</Text>

        {/* Security */}
        <TouchableOpacity style={styles.sectionBtn} onPress={() => toggle('security')}>
          <View style={styles.sectionLeft}>
            <Feather name="shield" size={18} color={colors.orange} />
            <Text style={styles.sectionText}>{i18n.t('security')}</Text>
          </View>
          <Feather name={openSection === 'security' ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
        </TouchableOpacity>
        {openSection === 'security' && (
          <Card>
            <View style={[styles.optRow, styles.optBorder]}>
              <Feather name="lock" size={18} color={colors.green} />
              <Text style={styles.optText}>{i18n.t('pinCode')}</Text>
              <Switch
                value={pinEnabled}
                onValueChange={(val) => {
                  if (val) setShowPinModal('setup');
                  else setShowPinModal('remove');
                }}
                trackColor={{ false: colors.bg2, true: colors.greenSoft }}
                thumbColor={pinEnabled ? colors.green : colors.textMuted}
              />
            </View>
            {pinEnabled && bioAvailable && (
              <View style={styles.optRow}>
                <Feather name="smartphone" size={18} color={colors.teal} />
                <Text style={styles.optText}>{i18n.t('biometricLock')}</Text>
                <Switch
                  value={bioEnabled}
                  onValueChange={async (val) => {
                    if (val) {
                      const ok = await securityService.authenticateWithBiometric(i18n.t('biometricLock'));
                      if (ok) {
                        await securityService.setBiometricEnabled(true);
                        setBioEnabled(true);
                        toast.show(i18n.t('biometricEnabled'), 'success');
                      }
                    } else {
                      await securityService.setBiometricEnabled(false);
                      setBioEnabled(false);
                      toast.show(i18n.t('biometricDisabled'), 'info');
                    }
                  }}
                  trackColor={{ false: colors.bg2, true: colors.greenSoft }}
                  thumbColor={bioEnabled ? colors.green : colors.textMuted}
                />
              </View>
            )}
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
            <Text style={styles.sectionValue} onPress={() => {
              versionTapCount.current++;
              clearTimeout(versionTapTimer.current);
              versionTapTimer.current = setTimeout(() => { versionTapCount.current = 0; }, 2000);
              if (versionTapCount.current >= 5) {
                versionTapCount.current = 0;
                Sentry?.captureException(new Error('Sentry test crash from Settings'));
                toast.show(i18n.t('sentryTestSent'));
              }
            }}>v1.0.0</Text>
            <Feather name={openSection === 'about' ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
          </View>
        </TouchableOpacity>
        {openSection === 'about' && (
          <Card>
            <Text style={styles.aboutText}>{i18n.t('aboutText')}</Text>
            <Text style={styles.aboutDisclaimer}>{i18n.t('notFinancialAdvice')}</Text>
            <View style={{ gap: 8, marginTop: 12 }}>
              <TouchableOpacity onPress={() => Linking.openURL('https://qaizo.app/privacy-policy.html')}>
                <Text style={styles.aboutLink}>{i18n.t('privacyPolicy')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Linking.openURL('https://qaizo.app/terms.html')}>
                <Text style={styles.aboutLink}>{i18n.t('termsOfService')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Linking.openURL('https://qaizo.app/help')}>
                <Text style={styles.aboutLink}>{i18n.t('help')}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL('mailto:support@qaizo.app')}>
                <Feather name="mail" size={16} color={colors.green} />
                <Text style={styles.contactTxt}>{i18n.t('contactEmail')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL('https://wa.me/972586995577')}>
                <Feather name="message-circle" size={16} color={colors.green} />
                <Text style={styles.contactTxt}>{i18n.t('contactWhatsapp')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.aboutCopy}>© 2026 Qaizo</Text>
          </Card>
        )}




      </ScrollView>

      <ExportModal visible={showExport} onClose={() => setShowExport(false)} onResult={handleExportResult} />
      <ImportModal visible={showImport} onClose={() => setShowImport(false)} onImported={() => toast.show(i18n.t('importDone'), 'success')} />

      <ConfirmModal visible={showLangRestart}
        title={i18n.t('langChanged')} message={i18n.t('restartApp')}
        confirmText="OK" cancelText={null} confirmColor={colors.green}
        onConfirm={async () => {
          setShowLangRestart(false);
          // Apply language change
          const code = await AsyncStorage.getItem('qaizo_lang_code');
          if (code) { i18n.setLanguage(code); setLang(code); setLangVersion(n => n + 1); }
          // Try reload
          try {
            const { reloadAsync } = await import('expo-updates');
            await reloadAsync?.();
          } catch (e) {}
        }}
        onCancel={async () => {
          setShowLangRestart(false);
          const code = await AsyncStorage.getItem('qaizo_lang_code');
          if (code) { i18n.setLanguage(code); setLang(code); setLangVersion(n => n + 1); }
        }}
        icon="globe" />

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
          const result = await authService.deleteAccount();
          if (!result.success && result.error === 'reauth') {
            await authService.logout();
            toast.show(i18n.t('reloginToDelete'), 'warning');
          } else {
            toast.show(i18n.t('accountDeleted'), 'success');
          }
          setShowDeleteAccount(false);
        }}
        onCancel={() => setShowDeleteAccount(false)}
        icon="user-x" />

      <Modal visible={showPinModal !== null} animationType="slide">
        <PinScreen
          mode={showPinModal || 'setup'}
          onSuccess={() => {
            if (showPinModal === 'setup') {
              setPinEnabled(true);
              toast.show(i18n.t('pinEnabled'), 'success');
            } else {
              setPinEnabled(false);
              setBioEnabled(false);
              toast.show(i18n.t('pinDisabled'), 'info');
            }
            setShowPinModal(null);
          }}
          onCancel={() => setShowPinModal(null)}
        />
      </Modal>

      <CurrencyPickerModal visible={showCurrencyPicker}
        onClose={() => setShowCurrencyPicker(false)}
        selected={CURRENCIES.find(c => c.symbol === curSymbol)?.code || 'ILS'}
        onSelect={(cur) => changeCurrency(cur)} />
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', flex: 1, textAlign: 'center' },

  groupTitle: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginHorizontal: 24, marginTop: 24, marginBottom: 4 },
  sectionBtn: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 20, marginTop: 12, backgroundColor: colors.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: colors.cardBorder },
  sectionLeft: { flexDirection: i18n.row(), alignItems: 'center', gap: 12 },
  sectionText: { color: colors.text, fontSize: 16, fontWeight: '600', textAlign: i18n.textAlign() },
  sectionRight: { flexDirection: i18n.row(), alignItems: 'center', gap: 8 },
  sectionValue: { color: colors.textDim, fontSize: 14, fontWeight: '500' },
  comingSoonBadge: { color: colors.textMuted, fontSize: 12, fontWeight: '600', backgroundColor: colors.bg2, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  extraInput: { backgroundColor: colors.bg, borderRadius: 12, padding: 14, color: colors.text, fontSize: 16, fontWeight: '700', borderWidth: 1, borderColor: colors.cardBorder, writingDirection: 'ltr' },
  extraSaveBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center' },

  optRow: { flexDirection: i18n.row(), alignItems: 'center', paddingVertical: 16, gap: 12 },
  optBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  optEmoji: { fontSize: 20 },
  optText: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '500', textAlign: i18n.textAlign() },

  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.textMuted, justifyContent: 'center', alignItems: 'center' },
  radioOn: { borderColor: colors.green },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.green },

  aboutRow: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  aboutLogo: { color: colors.text, fontSize: 20, fontWeight: '800' },
  aboutVer: { color: colors.textMuted, fontSize: 12 },
  aboutText: { color: colors.textDim, fontSize: 14, lineHeight: 22, marginBottom: 8 },
  aboutDisclaimer: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 4 },
  aboutLink: { color: colors.green, fontSize: 14, fontWeight: '600' },
  contactBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.greenSoft },
  contactTxt: { color: colors.green, fontSize: 14, fontWeight: '600' },
  aboutCopy: { color: colors.textMuted, fontSize: 12 },

  // Account
  userRow: { flexDirection: i18n.row(), alignItems: 'center', marginBottom: 16 },
  avatarWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.greenSoft, justifyContent: 'center', alignItems: 'center', marginEnd: 14 },
  userName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  userEmail: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  logoutBtn: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.redSoft },
  logoutTxt: { color: colors.red, fontSize: 14, fontWeight: '600' },
  deleteAccountBtn: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  deleteAccountTxt: { color: colors.red, fontSize: 12, fontWeight: '500' },
  loginBtn: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  loginTxt: { color: colors.green, fontSize: 16, fontWeight: '700' },
});