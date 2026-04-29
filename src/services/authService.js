// src/services/authService.js
// Авторизация через Firebase Auth (native SDK)
import auth from '@react-native-firebase/auth';
import analyticsEvents from './analyticsEvents';

let GoogleSignin = null;
try {
  GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
  GoogleSignin.configure({
    webClientId: '568492177874-dku8ci4tcrd5b356iicj1f72vpe4bgm3.apps.googleusercontent.com',
  });
} catch (e) {
  // Native module not available (Expo Go) — Google Sign-In disabled
}

let appleAuth = null;
try {
  appleAuth = require('@invertase/react-native-apple-authentication').default;
} catch (e) {
  // Native module not available (Expo Go / Android) — Apple Sign-In disabled
}

const authService = {

  // Текущий пользователь
  getCurrentUser() {
    return auth().currentUser;
  },

  // UID текущего пользователя
  getUid() {
    return auth().currentUser?.uid || null;
  },

  // Слушатель состояния авторизации
  onAuthChanged(callback) {
    return auth().onAuthStateChanged(callback);
  },

  // Регистрация
  async register(email, password, displayName) {
    try {
      const cred = await auth().createUserWithEmailAndPassword(email, password);
      if (displayName) {
        await cred.user.updateProfile({ displayName });
      }
      // Send verification email in app language
      let lang = 'en';
      try { const i18n = require('../i18n').default; lang = i18n.getLanguage(); } catch (e) {}
      auth().languageCode = lang;
      try { await cred.user.sendEmailVerification(); } catch (e) {}
      analyticsEvents.logEvent('user_registered', { method: 'email' });
      return { success: true, user: cred.user };
    } catch (e) {
      return { success: false, error: getErrorMessage(e.code) };
    }
  },

  // Вход
  async login(email, password) {
    try {
      const cred = await auth().signInWithEmailAndPassword(email, password);
      analyticsEvents.logEvent('user_logged_in', { method: 'email' });
      return { success: true, user: cred.user };
    } catch (e) {
      return { success: false, error: getErrorMessage(e.code) };
    }
  },

  // Выход
  async logout() {
    try {
      await auth().signOut();
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // Google Sign-In (native)
  async loginWithGoogle() {
    try {
      if (!GoogleSignin) return { success: false, error: 'Google Sign-In not available in Expo Go' };
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;
      if (!idToken) {
        return { success: false, error: 'No ID token received' };
      }
      const credential = auth.GoogleAuthProvider.credential(idToken);
      const cred = await auth().signInWithCredential(credential);
      analyticsEvents.logEvent(cred.additionalUserInfo?.isNewUser ? 'user_registered' : 'user_logged_in', { method: 'google' });
      return { success: true, user: cred.user };
    } catch (e) {
      if (e.code === 'SIGN_IN_CANCELLED') {
        return { success: false, error: 'Google sign-in cancelled' };
      }
      return { success: false, error: e.message || 'Google sign-in failed' };
    }
  },

  // Apple Sign-In (native, iOS only)
  async loginWithApple() {
    try {
      if (!appleAuth) return { success: false, error: 'Apple Sign-In not available' };
      const appleAuthRequest = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
      });
      const { identityToken, nonce } = appleAuthRequest;
      if (!identityToken) return { success: false, error: 'No identity token received' };
      const credential = auth.AppleAuthProvider.credential(identityToken, nonce);
      const cred = await auth().signInWithCredential(credential);
      analyticsEvents.logEvent(cred.additionalUserInfo?.isNewUser ? 'user_registered' : 'user_logged_in', { method: 'apple' });
      return { success: true, user: cred.user };
    } catch (e) {
      if (e.code === appleAuth?.Error?.CANCELED) {
        return { success: false, error: 'Apple sign-in cancelled' };
      }
      return { success: false, error: e.message || 'Apple sign-in failed' };
    }
  },

  // Удаление аккаунта (Apple requirement)
  async deleteAccount() {
    try {
      const user = auth().currentUser;
      if (user) {
        await user.delete();
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.code === 'auth/requires-recent-login' ? 'reauth' : e.message };
    }
  },

  // Сброс пароля
  async resetPassword(email) {
    try {
      let lang = 'en';
      try { const i18n = require('../i18n').default; lang = i18n.getLanguage(); } catch (e) {}
      auth().languageCode = lang;
      await auth().sendPasswordResetEmail(email);
      return { success: true };
    } catch (e) {
      return { success: false, error: getErrorMessage(e.code) };
    }
  },
};

// Человекочитаемые ошибки
function getErrorMessage(code) {
  const messages = {
    'auth/email-already-in-use': { ru: 'Этот email уже зарегистрирован', he: 'אימייל זה כבר רשום', en: 'Email already registered' },
    'auth/invalid-email': { ru: 'Неверный формат email', he: 'פורמט אימייל שגוי', en: 'Invalid email format' },
    'auth/weak-password': { ru: 'Пароль слишком короткий (мин. 6 символов)', he: 'סיסמה קצרה מדי (מינ. 6 תווים)', en: 'Password too short (min 6 chars)' },
    'auth/user-not-found': { ru: 'Пользователь не найден', he: 'משתמש לא נמצא', en: 'User not found' },
    'auth/wrong-password': { ru: 'Неверный пароль', he: 'סיסמה שגויה', en: 'Wrong password' },
    'auth/invalid-credential': { ru: 'Неверный email или пароль', he: 'אימייל או סיסמה שגויים', en: 'Invalid email or password' },
    'auth/too-many-requests': { ru: 'Слишком много попыток. Подождите', he: 'יותר מדי ניסיונות. המתן', en: 'Too many attempts. Please wait' },
    'auth/network-request-failed': { ru: 'Нет подключения к интернету', he: 'אין חיבור לאינטרנט', en: 'No internet connection' },
  };
  let lang = 'en';
  try { const i18n = require('../i18n').default; lang = i18n.getLanguage(); } catch (e) {}
  const msg = messages[code];
  if (msg) return msg[lang] || msg.en;
  return code || 'Unknown error';
}

export default authService;
