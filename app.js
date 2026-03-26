// App.js
// Поток: автодетекция языка → онбординг → визард → приложение
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import * as Localization from 'expo-localization';
import { useEffect, useState } from 'react';
import { I18nManager, StatusBar, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import i18n from './src/i18n';
import AppNavigator from './src/navigation/AppNavigator';
import OnboardingScreen from './src/screens/OnboardingScreen';
import SetupWizardScreen from './src/screens/SetupWizardScreen';
import dataService from './src/services/dataService';

const DarkTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#0a0e1a',
    card: '#0a0e1a',
    border: '#0a0e1a',
  },
};

const LANG_MANUAL_KEY = 'qaizo_lang_manual';
const ONBOARDING_KEY = 'qaizo_onboarding_done';
const WIZARD_KEY = 'qaizo_wizard_done';

function detectSystemLanguage() {
  try {
    const locales = Localization.getLocales();
    if (locales && locales.length > 0) {
      const code = locales[0].languageCode;
      if (code === 'he' || code === 'iw') return 'he';
      if (code === 'ru') return 'ru';
    }
  } catch (e) {
    console.log('Language detection error:', e);
  }
  return 'en';
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState('app'); // 'onboarding' | 'wizard' | 'app'

  useEffect(() => {
    (async () => {
      try {
        const settings = await dataService.getSettings();
        const manualFlag = await AsyncStorage.getItem(LANG_MANUAL_KEY);
        const onboardingDone = await AsyncStorage.getItem(ONBOARDING_KEY);
        const wizardDone = await AsyncStorage.getItem(WIZARD_KEY);

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

        if (onboardingDone !== 'true') {
          setScreen('onboarding');
        } else if (wizardDone !== 'true') {
          setScreen('wizard');
        } else {
          setScreen('app');
        }
      } catch (e) {
        console.error('Error loading settings:', e);
      }
      setReady(true);
    })();
  }, []);

  const handleOnboardingDone = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setScreen('wizard');
  };

  const handleWizardDone = async () => {
    await AsyncStorage.setItem(WIZARD_KEY, 'true');
    setScreen('app');
  };

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: '#0a0e1a' }} />;
  }

  if (screen === 'onboarding') {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0a0e1a' }}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0e1a" />
        <OnboardingScreen onDone={handleOnboardingDone} />
      </GestureHandlerRootView>
    );
  }

  if (screen === 'wizard') {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0a0e1a' }}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0e1a" />
        <SetupWizardScreen onDone={handleWizardDone} />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0a0e1a' }}>
      <NavigationContainer theme={DarkTheme}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0e1a" />
        <AppNavigator />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}