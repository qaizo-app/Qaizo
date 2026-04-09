// src/screens/PinScreen.js
// Экран ввода PIN-кода (4 цифры)
import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
import i18n from '../i18n';
import securityService from '../services/securityService';
import { colors } from '../theme/colors';

export default function PinScreen({ mode = 'unlock', onSuccess, onCancel }) {
  // mode: 'unlock' | 'setup' | 'confirm' | 'remove'
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState(''); // for setup confirm
  const [step, setStep] = useState(mode === 'setup' ? 'enter' : mode); // enter → confirm (setup)
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  useEffect(() => {
    // Try biometric on unlock
    if (mode === 'unlock') {
      (async () => {
        const bioEnabled = await securityService.isBiometricEnabled();
        if (bioEnabled) {
          const ok = await securityService.authenticateWithBiometric(i18n.t('unlockQaizo'));
          if (ok) onSuccess?.();
        }
      })();
    }
  }, []);

  const title = step === 'enter' && mode === 'setup' ? i18n.t('createPin')
    : step === 'confirm' ? i18n.t('confirmPin')
    : mode === 'remove' ? i18n.t('enterCurrentPin')
    : i18n.t('enterPin');

  const handlePress = async (digit) => {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    setError('');

    if (next.length === 4) {
      if (mode === 'setup' && step === 'enter') {
        // First entry — save and ask to confirm
        setFirstPin(next);
        setPin('');
        setStep('confirm');
      } else if (mode === 'setup' && step === 'confirm') {
        // Confirm entry
        if (next === firstPin) {
          await securityService.setPin(next);
          onSuccess?.();
        } else {
          triggerError(i18n.t('pinsDontMatch'));
          setStep('enter');
          setFirstPin('');
        }
      } else if (mode === 'unlock') {
        const ok = await securityService.verifyPin(next);
        if (ok) {
          onSuccess?.();
        } else {
          triggerError(i18n.t('wrongPin'));
        }
      } else if (mode === 'remove') {
        const ok = await securityService.verifyPin(next);
        if (ok) {
          await securityService.removePin();
          onSuccess?.();
        } else {
          triggerError(i18n.t('wrongPin'));
        }
      }
    }
  };

  const triggerError = (msg) => {
    setError(msg);
    setShake(true);
    Vibration.vibrate(200);
    setPin('');
    setTimeout(() => setShake(false), 500);
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    setError('');
  };

  const handleBiometric = async () => {
    const ok = await securityService.authenticateWithBiometric(i18n.t('unlockQaizo'));
    if (ok) onSuccess?.();
  };

  const st = createSt();
  const dots = [0, 1, 2, 3];
  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['bio', '0', 'del'],
  ];

  return (
    <View style={st.container}>
      <View style={st.top}>
        <View style={st.iconWrap}>
          <Feather name="lock" size={28} color={colors.green} />
        </View>
        <Text style={st.title}>{title}</Text>

        {/* Dots */}
        <View style={st.dotsRow}>
          {dots.map(i => (
            <View key={i} style={[st.dot, pin.length > i && st.dotFilled, shake && st.dotError]} />
          ))}
        </View>

        {error ? <Text style={st.error}>{error}</Text> : null}
      </View>

      {/* Numpad */}
      <View style={st.numpad}>
        {keys.map((row, ri) => (
          <View key={ri} style={st.numRow}>
            {row.map((k) => {
              if (k === 'bio') {
                if (mode !== 'unlock') return <View key={k} style={st.numKey} />;
                return (
                  <TouchableOpacity key={k} style={st.numKey} onPress={handleBiometric} activeOpacity={0.6}>
                    <Feather name="smartphone" size={24} color={colors.textDim} />
                  </TouchableOpacity>
                );
              }
              if (k === 'del') {
                return (
                  <TouchableOpacity key={k} style={st.numKey} onPress={handleDelete} activeOpacity={0.6}>
                    <Feather name="delete" size={24} color={colors.textDim} />
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity key={k} style={st.numKey} onPress={() => handlePress(k)} activeOpacity={0.6}>
                  <Text style={st.numText}>{k}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {onCancel && (
        <TouchableOpacity style={st.cancelBtn} onPress={onCancel}>
          <Text style={st.cancelTxt}>{i18n.t('cancel')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const createSt = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  top: { alignItems: 'center', marginBottom: 40 },
  iconWrap: { width: 60, height: 60, borderRadius: 20, backgroundColor: colors.greenSoft, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 24 },
  dotsRow: { flexDirection: 'row', gap: 16, writingDirection: 'ltr' },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.textMuted, backgroundColor: 'transparent' },
  dotFilled: { backgroundColor: colors.green, borderColor: colors.green },
  dotError: { borderColor: colors.red },
  error: { color: colors.red, fontSize: 14, fontWeight: '600', marginTop: 16 },

  numpad: { gap: 12, direction: 'ltr' },
  numRow: { flexDirection: 'row', gap: 24 },
  numKey: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  numText: { color: colors.text, fontSize: 24, fontWeight: '600' },

  cancelBtn: { marginTop: 30 },
  cancelTxt: { color: colors.textMuted, fontSize: 16, fontWeight: '500' },
});
