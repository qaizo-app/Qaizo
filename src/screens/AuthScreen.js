// src/screens/AuthScreen.js
// Логин / Регистрация — тёмная тема
import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ConfirmModal from '../components/ConfirmModal';
import i18n from '../i18n';
import authService from '../services/authService';
import { colors } from '../theme/colors';

export default function AuthScreen({ onSkip }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [name, setName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showResetSent, setShowResetSent] = useState(false);
  const [showVerifyEmail, setShowVerifyEmail] = useState(false);
  const st = createSt();

  const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const passStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const passColors = ['', colors.red, colors.yellow, colors.green];

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    if (!isValidEmail(email.trim())) { setError(i18n.t('invalidEmail')); return; }
    setLoading(true);
    setError('');
    const result = await authService.login(email.trim(), password);
    setLoading(false);
    if (result.success) {
      if (!result.user.emailVerified) {
        await authService.logout();
        setShowVerifyEmail(true);
      }
    } else {
      setError(result.error);
    }
  };

  const handleRegister = async () => {
    if (!email.trim() || !password.trim()) return;
    if (!isValidEmail(email.trim())) { setError(i18n.t('invalidEmail')); return; }
    if (password.length < 6) { setError(i18n.t('passwordTooShort')); return; }
    if (password !== confirmPass) { setError(i18n.t('passwordsMismatch')); return; }
    setLoading(true);
    setError('');
    const result = await authService.register(email.trim(), password, name.trim() || null);
    setLoading(false);
    if (result.success) {
      await authService.logout();
      setShowVerifyEmail(true);
    } else {
      setError(result.error);
    }
  };

  const handleReset = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    const result = await authService.resetPassword(email.trim());
    setLoading(false);
    if (result.success) {
      setShowResetSent(true);
    } else {
      setError(result.error);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    const result = await authService.loginWithGoogle();
    setLoading(false);
    if (!result.success) setError(result.error);
  };

  const handleSubmit = () => {
    if (mode === 'login') handleLogin();
    else if (mode === 'register') handleRegister();
    else handleReset();
  };

  const tc = colors.green;

  return (
    <KeyboardAvoidingView style={st.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        bounces={false} overScrollMode="never">

        {/* Лого */}
        <View style={st.logoWrap}>
          <Text style={st.logo}><Text style={{ color: tc }}>Q</Text>aizo</Text>
          <Text style={st.slogan}>Smarter every day.</Text>
        </View>

        {/* Заголовок */}
        <Text style={st.title}>
          {mode === 'login' ? i18n.t('authLogin') : mode === 'register' ? i18n.t('authRegister') : i18n.t('authReset')}
        </Text>

        {/* Ошибка */}
        {error ? (
          <View style={st.errorBox}>
            <Feather name="alert-circle" size={16} color={colors.red} />
            <Text style={st.errorTxt}>{error}</Text>
          </View>
        ) : null}

        {/* Имя (только регистрация) */}
        {mode === 'register' && (
          <View style={st.inputWrap}>
            <Feather name="user" size={18} color={colors.textMuted} style={st.inputIcon} />
            <TextInput style={st.input} value={name} onChangeText={setName}
              placeholder={i18n.t('yourName')} placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              autoComplete="off" importantForAutofill="noExcludeDescendants"
              textContentType="none" />
          </View>
        )}

        {/* Email */}
        <View style={st.inputWrap}>
          <Feather name="mail" size={18} color={colors.textMuted} style={st.inputIcon} />
          <TextInput style={st.input} value={email} onChangeText={setEmail}
            placeholder={i18n.t('emailPlaceholder')} placeholderTextColor={colors.textMuted}
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            autoComplete="off" importantForAutofill="noExcludeDescendants"
            textContentType="none" />
        </View>

        {/* Пароль (не для сброса) */}
        {mode !== 'reset' && (
          <>
            <View style={st.inputWrap}>
              <Feather name="lock" size={18} color={colors.textMuted} style={st.inputIcon} />
              <TextInput style={st.input} value={password} onChangeText={setPassword}
                placeholder={i18n.t('password')} placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPass} autoCapitalize="none"
                autoComplete="off" importantForAutofill="noExcludeDescendants"
                textContentType="none" />
              <TouchableOpacity onPress={() => setShowPass(!showPass)} style={st.eyeBtn}>
                <Feather name={showPass ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Индикатор силы пароля (только регистрация) */}
            {mode === 'register' && password.length > 0 && (
              <View style={st.strengthRow}>
                {[1, 2, 3].map(level => (
                  <View key={level} style={[st.strengthBar, passStrength >= level && { backgroundColor: passColors[passStrength] }]} />
                ))}
                <Text style={[st.strengthTxt, { color: passColors[passStrength] }]}>
                  {passStrength === 1 ? i18n.t('passWeak') : passStrength === 2 ? i18n.t('passMedium') : i18n.t('passStrong')}
                </Text>
              </View>
            )}

            {/* Подтверждение пароля (только регистрация) */}
            {mode === 'register' && (
              <View style={st.inputWrap}>
                <Feather name="check-circle" size={18} color={confirmPass && confirmPass === password ? colors.green : colors.textMuted} style={st.inputIcon} />
                <TextInput style={st.input} value={confirmPass} onChangeText={setConfirmPass}
                  placeholder={i18n.t('confirmPassword')} placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPass} autoCapitalize="none"
                  autoComplete="off" importantForAutofill="noExcludeDescendants"
                  textContentType="none" />
              </View>
            )}
          </>
        )}

        {/* Кнопка действия */}
        <TouchableOpacity style={[st.mainBtn, loading && { opacity: 0.6 }]}
          onPress={handleSubmit} disabled={loading} activeOpacity={0.8}>
          {loading ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text style={st.mainBtnTxt}>
              {mode === 'login' ? i18n.t('authLoginBtn') : mode === 'register' ? i18n.t('authRegisterBtn') : i18n.t('authResetBtn')}
            </Text>
          )}
        </TouchableOpacity>

        {/* Google Sign-In */}
        {mode !== 'reset' && (
          <>
            <View style={st.orRow}>
              <View style={st.orLine} />
              <Text style={st.orTxt}>{i18n.t('or')}</Text>
              <View style={st.orLine} />
            </View>
            <TouchableOpacity style={st.googleBtn} onPress={handleGoogle} disabled={loading} activeOpacity={0.8}>
              <Text style={st.googleG}>G</Text>
              <Text style={st.googleTxt}>{i18n.t('continueWithGoogle')}</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Забыл пароль */}
        {mode === 'login' && (
          <TouchableOpacity style={st.linkBtn} onPress={() => { setMode('reset'); setError(''); }}>
            <Text style={st.linkTxt}>{i18n.t('forgotPassword')}</Text>
          </TouchableOpacity>
        )}

        {/* Переключение логин/регистрация */}
        <View style={st.switchRow}>
          <Text style={st.switchTxt}>
            {mode === 'login' ? i18n.t('noAccount') : mode === 'register' ? i18n.t('hasAccount') : i18n.t('rememberPassword')}
          </Text>
          <TouchableOpacity onPress={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError('');
          }}>
            <Text style={st.switchLink}>
              {mode === 'login' ? i18n.t('authRegisterBtn') : i18n.t('authLoginBtn')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Пропустить */}
        <TouchableOpacity style={st.skipBtn} onPress={onSkip}>
          <Text style={st.skipTxt}>{i18n.t('continueWithout')}</Text>
        </TouchableOpacity>

      </ScrollView>

      <ConfirmModal visible={showResetSent}
        title={i18n.t('resetSent')} message={email}
        confirmText="OK" cancelText={null}
        confirmColor={colors.green}
        onConfirm={() => { setShowResetSent(false); setMode('login'); }}
        onCancel={() => { setShowResetSent(false); setMode('login'); }}
        icon="mail" />

      <ConfirmModal visible={showVerifyEmail}
        title={i18n.t('verifyEmailTitle')} message={i18n.t('verifyEmailMessage')}
        confirmText={i18n.t('verifyDone')} cancelText={i18n.t('resendEmail')}
        confirmColor={colors.green}
        onConfirm={async () => {
          // Try login again to check verification
          setShowVerifyEmail(false);
          setMode('login');
        }}
        onCancel={async () => {
          // Resend verification email
          try {
            const result = await authService.login(email.trim(), password);
            if (result.success) {
              let lang = 'en';
              try { lang = i18n.getLanguage(); } catch (e) {}
              const { sendEmailVerification: sendVerif } = require('firebase/auth');
              const { auth: fbAuth } = require('../config/firebase');
              fbAuth.languageCode = lang;
              await sendVerif(result.user);
              await authService.logout();
            }
          } catch (e) {}
        }}
        icon="mail" />
    </KeyboardAvoidingView>
  );
}

const createSt = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 40 },

  logoWrap: { alignItems: 'center', marginBottom: 40 },
  logo: { color: colors.text, fontSize: 42, fontWeight: '800', letterSpacing: -2 },
  slogan: { color: colors.textMuted, fontSize: 14, fontWeight: '500', marginTop: 6 },

  title: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 24 },

  errorBox: { flexDirection: i18n.row(), alignItems: 'center', gap: 8, backgroundColor: colors.redSoft, borderRadius: 12, padding: 14, marginBottom: 16 },
  errorTxt: { color: colors.red, fontSize: 13, fontWeight: '600', flex: 1 },

  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, marginBottom: 14 },
  inputIcon: { marginStart: 16 },
  input: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 16, paddingHorizontal: 12, textAlign: i18n.textAlign() },
  eyeBtn: { paddingHorizontal: 16, paddingVertical: 16 },

  strengthRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 6, marginBottom: 14, marginTop: -6, paddingHorizontal: 4 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.divider },
  strengthTxt: { fontSize: 11, fontWeight: '600', marginStart: 8 },

  mainBtn: { backgroundColor: colors.green, borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginTop: 8, marginBottom: 12 },
  mainBtnTxt: { color: colors.bg, fontSize: 16, fontWeight: '700' },

  linkBtn: { alignItems: 'center', paddingVertical: 8 },
  linkTxt: { color: colors.textDim, fontSize: 14, fontWeight: '500' },

  switchRow: { flexDirection: i18n.row(), justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 24 },
  switchTxt: { color: colors.textMuted, fontSize: 14 },
  switchLink: { color: colors.green, fontSize: 14, fontWeight: '700' },

  orRow: { flexDirection: i18n.row(), alignItems: 'center', marginVertical: 16 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.divider },
  orTxt: { color: colors.textMuted, fontSize: 13, fontWeight: '500', marginHorizontal: 16 },
  googleBtn: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderRadius: 14, paddingVertical: 16, borderWidth: 1, borderColor: colors.cardBorder, gap: 10, marginBottom: 8 },
  googleG: { fontSize: 20, fontWeight: '800', color: '#4285F4' },
  googleTxt: { color: colors.text, fontSize: 15, fontWeight: '600' },

  skipBtn: { alignItems: 'center', marginTop: 20 },
  skipTxt: { color: colors.textMuted, fontSize: 13, fontWeight: '500', textDecorationLine: 'underline' },
});