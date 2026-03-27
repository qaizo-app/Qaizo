// App.js
// Поток: тема → язык → онбординг → визард → авторизация → приложение
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import * as Localization from 'expo-localization';
import { useEffect, useState } from 'react';
import { I18nManager, StatusBar, View } from 'react-native';
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
        if (manualFlag === 'true' && settings.language) {
          lang = settings.language;
        } else {
          lang = detectSystemLanguage();
          await dataService.saveSettings({ ...settings, language: lang });
        }

        i18n.setLanguage(lang);
        const shouldBeRTL = lang === 'he';
        if (I18nManager.isRTL !== shouldBeRTL) {
          I18nManager.allowRTL(true);
          I18nManager.forceRTL(shouldBeRTL);
        }

        setAuthSkipped(skipped === 'true');

        // Всегда слушаем auth — даже если флаги сброшены, юзер может быть залогинен
        unsubAuth = authService.onAuthChanged(async (u) => {
          setUser(u);
          if (u) {
            // Залогинен — пропускаем онбординг и auth, восстанавливаем флаги
            if (onboardingDone !== 'true') await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
            try { await dataService.migrateToFirestore(); } catch (e) {}
            if (wizardDone !== 'true') setScreen('wizard');
            else setScreen('app');
          } else if (onboardingDone !== 'true') {
            setScreen('onboarding');
          } else if (skipped === 'true') {
            if (wizardDone !== 'true') setScreen('wizard');
            else setScreen('app');
          } else {
            setScreen('auth');
          }
        });
      } catch (e) {
        console.error('Error loading:', e);
      }

      // Инициализация уведомлений
      try {
        await notificationService.setupAndroidChannel();
        const granted = await notificationService.requestPermission();
        if (granted) {
          await notificationService.scheduleRecurringNotifications();
          await notificationService.scheduleStreakReminder();
        }
      } catch (e) {}

      setReady(true);
    })();

    return () => { if (unsubAuth) unsubAuth(); };
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

  if (screen === 'onboarding') {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar barStyle={statusStyle} backgroundColor={colors.bg} />
        <OnboardingScreen onDone={handleOnboardingDone} />
      </GestureHandlerRootView>
    );
  }

  if (screen === 'wizard') {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar barStyle={statusStyle} backgroundColor={colors.bg} />
        <SetupWizardScreen onDone={handleWizardDone} />
      </GestureHandlerRootView>
    );
  }

  if (screen === 'auth') {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar barStyle={statusStyle} backgroundColor={colors.bg} />
        <AuthScreen onSkip={handleSkipAuth} />
      </GestureHandlerRootView>
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

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </ThemeProvider>
  );
}
