// App.js
// Поток: тема → язык → онбординг → визард → авторизация → приложение
let Sentry = null;
try {
  Sentry = require('@sentry/react-native');
  const appJson = require('./app.json');
  const consentSvc = require('./src/services/consentService').default;
  const version = appJson?.expo?.version || '0.0.0';
  const build = appJson?.expo?.android?.versionCode || 0;
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    enabled: !__DEV__,
    release: `com.qaizo.app@${version}+${build}`,
    dist: String(build),
    tracesSampleRate: 0,
    enableStallTracking: false,
    enableAppStartTracking: false,
    enableNativeFramesTracking: false,
    attachScreenshot: false,
    // Drop events when the user has opted out of crash reporting.
    // consentSvc defaults to true until load() reads the persisted value.
    beforeSend: (event) => consentSvc.getCrashReportsConsent() ? event : null,
  });
} catch (e) {
  // Sentry not available (Expo Go) — app continues without crash reporting
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import * as Localization from 'expo-localization';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { AppState, I18nManager, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';

// Disable system font scaling globally — prevents layout breaks on large accessibility fonts
Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.allowFontScaling = false;
TextInput.defaultProps = TextInput.defaultProps || {};
TextInput.defaultProps.allowFontScaling = false;

// Global RTL patch: I18nManager flips textAlign ('right' becomes 'left')
// So we REMOVE explicit textAlign:'right' and let the system handle alignment
const _originalCreate = StyleSheet.create;
StyleSheet.create = function(styles) {
  if (I18nManager.isRTL) {
    const patched = {};
    let changed = false;
    for (const key in styles) {
      const s = styles[key];
      if (s && s.textAlign === 'right') {
        const { textAlign, ...rest } = s;
        patched[key] = rest;
        changed = true;
      } else {
        patched[key] = s;
      }
    }
    return _originalCreate(changed ? patched : styles);
  }
  return _originalCreate(styles);
};
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import i18n from './src/i18n';
import AppNavigator from './src/navigation/AppNavigator';
import AuthScreen from './src/screens/AuthScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import SetupWizardScreen from './src/screens/SetupWizardScreen';
import authService from './src/services/authService';
import consentService from './src/services/consentService';
import analyticsEvents from './src/services/analyticsEvents';
import dataService from './src/services/dataService';
import exchangeRateService from './src/services/exchangeRateService';
import feedbackService from './src/services/feedbackService';
import notificationService from './src/services/notificationService';
import securityService from './src/services/securityService';
import PinScreen from './src/screens/PinScreen';
import RateAppModal from './src/components/RateAppModal';
import { colors } from './src/theme/colors';
import { CURRENCIES, setCurrency } from './src/utils/currency';
import { ToastProvider } from './src/components/ToastProvider';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

const LANG_MANUAL_KEY = 'qaizo_lang_manual';
const ONBOARDING_KEY = 'qaizo_onboarding_done';
const WIZARD_KEY = 'qaizo_wizard_done';
const AUTH_SKIPPED_KEY = 'qaizo_auth_skipped';

function detectSystemLanguage() {
  try {
    const locales = Localization.getLocales();
    if (locales && locales.length > 0) {
      const code = locales[0].languageCode;
      if (code === 'he' || code === 'iw') return 'he';
      if (code === 'ru') return 'ru';
      if (code === 'ar') return 'ar';
      if (code === 'es') return 'es';
      if (code === 'fr') return 'fr';
      if (code === 'de') return 'de';
      if (code === 'pt') return 'pt';
      if (code === 'zh') return 'zh';
      if (code === 'hi') return 'hi';
      if (code === 'ja') return 'ja';
    }
  } catch (e) {}
  return 'en';
}

function AppInner() {
  const { theme, themeKey } = useTheme();
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState('app');
  const [user, setUser] = useState(null);
  const [authSkipped, setAuthSkipped] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [showRatePrompt, setShowRatePrompt] = useState(false);

  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: colors.bg,
      card: colors.bg,
      border: colors.bg,
    },
  };

  const statusStyle = (theme === 'dark' || theme === 'amoled') ? 'light-content' : 'dark-content';

  useEffect(() => {
    let unsubAuth = null;

    (async () => {
      try {
        const settings = await dataService.getSettings();
        const manualFlag = await AsyncStorage.getItem(LANG_MANUAL_KEY);
        const onboardingDone = await AsyncStorage.getItem(ONBOARDING_KEY);
        const wizardDone = await AsyncStorage.getItem(WIZARD_KEY);
        const skipped = await AsyncStorage.getItem(AUTH_SKIPPED_KEY);

        // Загрузить валюту
        if (settings.currency) {
          const cur = CURRENCIES.find(c => c.symbol === settings.currency);
          if (cur) setCurrency(cur.symbol, cur.code);
        }

        // Hydrate FX rates from disk + trigger background refresh (non-blocking)
        exchangeRateService.init().catch(() => {});

        let lang;
        const savedLangCode = await AsyncStorage.getItem('qaizo_lang_code');
        if (manualFlag === 'true' && savedLangCode) {
          lang = savedLangCode;
        } else if (manualFlag === 'true' && settings.language) {
          lang = settings.language;
        } else {
          lang = detectSystemLanguage();
          await dataService.saveSettings({ ...settings, language: lang });
        }

        i18n.setLanguage(lang);

        setAuthSkipped(skipped === 'true');

        // Check PIN lock before showing any screen
        const pinOn = await securityService.isPinEnabled();
        if (pinOn) setLocked(true);

        // Всегда слушаем auth — даже если флаги сброшены, юзер может быть залогинен
        unsubAuth = authService.onAuthChanged(async (u) => {
          if (u) try { await u.reload(); } catch (e) {}
          setUser(u);
          if (u && u.emailVerified) {
            // Залогинен + email подтверждён
            if (onboardingDone !== 'true') await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
            try { await dataService.migrateToFirestore(); } catch (e) {}
            if (wizardDone !== 'true') setScreen('wizard');
            else setScreen('app');
          } else if (u && !u.emailVerified) {
            // Залогинен но email не подтверждён — показать auth
            setScreen('auth');
          } else {
            // Re-read flags (may have changed during session)
            const currentOnboarding = await AsyncStorage.getItem(ONBOARDING_KEY);
            const currentSkipped = await AsyncStorage.getItem(AUTH_SKIPPED_KEY);
            const currentWizard = await AsyncStorage.getItem(WIZARD_KEY);
            if (currentOnboarding !== 'true') {
            setScreen('onboarding');
          } else if (currentSkipped === 'true') {
            if (currentWizard !== 'true') setScreen('wizard');
            else setScreen('app');
          } else {
            setScreen('auth');
          }
          }
          // Auth resolved — safe to show the app now
          setReady(true);
        });
      } catch (e) {
        if (__DEV__) console.error('Error loading:', e);
      }

      // Stamp first-run date so rate-prompt gating has a stable anchor.
      feedbackService.ensureInstallDate().catch(() => {});

      // Load consent first so Sentry / notifications / analytics respect the user's choice
      await consentService.load();
      // Warm the category cache so notification bodies and other background
      // callers can localize custom category names without a UI render first.
      try {
        const { ensureCachedGroups } = require('./src/utils/categoryCache');
        ensureCachedGroups();
      } catch (e) {}
      // Apply analytics consent to the native SDK and log session start
      await analyticsEvents.syncNativeConsent();
      analyticsEvents.logEvent('app_opened', { platform: 'android' });

      // Инициализация уведомлений — only if the user consented on the
      // onboarding screen. New installs haven't seen onboarding yet, so we
      // defer scheduling until onDone persists the consent.
      try {
        await notificationService.setupAndroidChannel();
        await notificationService.setupNotificationCategories();
        if (consentService.getReminderConsent()) {
          const granted = await notificationService.requestPermission();
          if (granted) {
            await notificationService.scheduleRecurringNotifications();
            await notificationService.scheduleStreakReminder();
            await notificationService.scheduleWeeklySummary();
          }
        }
      } catch (e) {}

      // Слушатель кнопок действий в уведомлениях
      const notifSub = Notifications.addNotificationResponseReceivedListener(response => {
        const action = response.actionIdentifier;
        if (action === 'add_income' || action === 'add_expense') {
          setPendingAction(action);
        }
      });

      // Notifications init — non-blocking, runs in background
    })();

    // Re-lock when app comes from background, unless the user was just
    // briefly away (UNLOCK_GRACE_MS) — in that case skip the prompt.
    const appStateRef = { current: AppState.currentState };
    const appStateSub = AppState.addEventListener('change', async (nextState) => {
      if (appStateRef.current === 'active' && nextState.match(/inactive|background/)) {
        // Leaving the foreground — remember when the user was last active.
        securityService.markActive();
      } else if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        const pinOn = await securityService.isPinEnabled();
        if (pinOn && !securityService.isWithinUnlockGrace()) setLocked(true);
      }
      appStateRef.current = nextState;
    });

    return () => {
      if (unsubAuth) unsubAuth();
      appStateSub.remove();
      notifSub?.remove?.();
    };
  }, []);

  // Trigger the rate prompt only when the user is past onboarding/auth/pin
  // AND has logged enough transactions over enough days. A short delay keeps
  // the modal from clobbering the first paint after login.
  useEffect(() => {
    if (screen !== 'app' || locked || !ready) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const txs = await dataService.getTransactions();
        const should = await feedbackService.shouldPrompt({ transactionCount: txs.length });
        if (!cancelled && should) setShowRatePrompt(true);
      } catch (e) {}
    }, 8000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [screen, locked, ready]);

  const handleOnboardingDone = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setScreen('auth');
  };

  const handleWizardDone = async () => {
    await AsyncStorage.setItem(WIZARD_KEY, 'true');
    setScreen('app');
  };

  const handleSkipAuth = async () => {
    await AsyncStorage.setItem(AUTH_SKIPPED_KEY, 'true');
    setAuthSkipped(true);
    const wizardDone = await AsyncStorage.getItem(WIZARD_KEY);
    if (wizardDone !== 'true') setScreen('wizard');
    else setScreen('app');
  };

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  if (locked) {
    return (
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
          <StatusBar barStyle={statusStyle} backgroundColor={colors.bg} />
          <PinScreen mode="unlock" onSuccess={() => { securityService.markActive(); setLocked(false); }} />
        </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }

  if (screen === 'onboarding') {
    return (
      <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar barStyle={statusStyle} backgroundColor={colors.bg} />
        <OnboardingScreen onDone={handleOnboardingDone} />
      </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }

  if (screen === 'wizard') {
    return (
      <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar barStyle={statusStyle} backgroundColor={colors.bg} />
        <SetupWizardScreen onDone={handleWizardDone} />
      </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }

  if (screen === 'auth') {
    return (
      <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar barStyle={statusStyle} backgroundColor={colors.bg} />
        <AuthScreen onSkip={handleSkipAuth} />
      </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavigationContainer theme={navTheme} key={`nav-${themeKey}`}>
        <StatusBar barStyle={statusStyle} backgroundColor={colors.bg} />
        <AppNavigator pendingAction={pendingAction} onPendingActionHandled={() => setPendingAction(null)} />
        <RateAppModal visible={showRatePrompt} onClose={() => setShowRatePrompt(false)} />
      </NavigationContainer>
    </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </ThemeProvider>
  );
}
