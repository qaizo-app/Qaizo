// src/services/authService.js
// Авторизация через Firebase Auth
import {
    GoogleAuthProvider,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithCredential,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
} from 'firebase/auth';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { auth } from '../config/firebase';

WebBrowser.maybeCompleteAuthSession();

const authService = {

  // Текущий пользователь
  getCurrentUser() {
    return auth.currentUser;
  },

  // UID текущего пользователя
  getUid() {
    return auth.currentUser?.uid || null;
  },

  // Слушатель состояния авторизации
  onAuthChanged(callback) {
    return onAuthStateChanged(auth, callback);
  },

  // Регистрация
  async register(email, password, displayName) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(cred.user, { displayName });
      }
      return { success: true, user: cred.user };
    } catch (e) {
      return { success: false, error: getErrorMessage(e.code) };
    }
  },

  // Вход
  async login(email, password) {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, user: cred.user };
    } catch (e) {
      return { success: false, error: getErrorMessage(e.code) };
    }
  },

  // Выход
  async logout() {
    try {
      await signOut(auth);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // Google Sign-In
  async loginWithGoogle() {
    try {
      const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) {
        return { success: false, error: 'Google Client ID not configured' };
      }
      const redirectUri = AuthSession.makeRedirectUri({ preferLocalhost: false });
      const discovery = {
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
      };
      const request = new AuthSession.AuthRequest({
        clientId,
        redirectUri,
        scopes: ['openid', 'profile', 'email'],
        responseType: AuthSession.ResponseType.IdToken,
        usePKCE: false,
      });
      const result = await request.promptAsync(discovery);
      if (result.type === 'success' && result.params?.id_token) {
        const credential = GoogleAuthProvider.credential(result.params.id_token);
        const cred = await signInWithCredential(auth, credential);
        return { success: true, user: cred.user };
      }
      return { success: false, error: 'Google sign-in cancelled' };
    } catch (e) {
      return { success: false, error: e.message || 'Google sign-in failed' };
    }
  },

  // Сброс пароля
  async resetPassword(email) {
    try {
      await sendPasswordResetEmail(auth, email);
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
  // Определяем язык из i18n
  let lang = 'en';
  try { const i18n = require('../i18n').default; lang = i18n.getLanguage(); } catch (e) {}
  const msg = messages[code];
  if (msg) return msg[lang] || msg.en;
  return code || 'Unknown error';
}

export default authService;