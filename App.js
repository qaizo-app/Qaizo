// App.js
// Поток: тема → язык → онбординг → визард → авторизация → приложение
import * as Sentry from '@sentry/react-native';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    enabled: !__DEV__,
    tracesSampleRate: 0.2,
  });
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import * as Localization from 'expo-localization';
import { useEffect, useRef, useState } from 'react';
import { AppState, I18nManager, StatusBar, StyleSheet, View } from 'react-native';

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
import dataService from './src/services/dataService';
import notificationService from './src/services/notificationService';
import securityService from './src/services/securityService';
import PinScreen from './src/screens/PinScreen';
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

  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: colors.bg,
      card: colors.bg,
      border: colors.bg,
    },
  };

  const statusStyle = theme === 'dark' ? 'light-content' : 'dark-content';

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
        });
      } catch (e) {
        if (__DEV__) console.error('Error loading:', e);
      }

      // Инициализация уведомлений
      try {
        await notificationService.setupAndroidChannel();
        const granted = await notificationService.requestPermission();
        if (granted) {
          await notificationService.scheduleRecurringNotifications();
          await notificationService.scheduleStreakReminder();
          await notificationService.scheduleWeeklySummary();
        }
      } catch (e) {}

      // Check PIN lock
      const pinOn = await securityService.isPinEnabled();
      if (pinOn) setLocked(true);

      setReady(true);
    })();

    // Re-lock when app comes from background
    const appStateRef = { current: AppState.currentState };
    const appStateSub = AppState.addEventListener('change', async (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        const pinOn = await securityService.isPinEnabled();
        if (pinOn) setLocked(true);
      }
      appStateRef.current = nextState;
    });

    return () => {
      if (unsubAuth) unsubAuth();
      appStateSub.remove();
    };
  }, []);

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
          <PinScreen mode="unlock" onSuccess={() => setLocked(false)} />
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
        <AppNavigator />
      </NavigationContainer>
    </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </ThemeProvider>
  );
});
