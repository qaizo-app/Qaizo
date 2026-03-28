// src/components/Toast.js
// Лёгкий toast — показывается сверху на 2.5 сек
import { Feather } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import { colors } from '../theme/colors';

const ICONS = { success: 'check-circle', error: 'alert-circle', info: 'info', warning: 'alert-triangle' };
const COLORS = { success: colors.green, error: colors.red, info: colors.blue, warning: colors.yellow };

export default function Toast({ visible, message, type = 'success', onHide, duration = 2500 }) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: -100, duration: 200, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start(() => onHide?.());
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  const st = createSt();
  const iconColor = COLORS[type] || colors.green;

  return (
    <Animated.View style={[st.container, { transform: [{ translateY }], opacity }]}>
      <TouchableOpacity style={st.inner} activeOpacity={0.9} onPress={onHide}>
        <Feather name={ICONS[type] || 'check-circle'} size={18} color={iconColor} />
        <Text style={st.text}>{message}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const createSt = () => StyleSheet.create({
  container: { position: 'absolute', top: 50, left: 20, right: 20, zIndex: 9999, elevation: 9999 },
  inner: { flexDirection: i18n.row(), alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.cardBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  text: { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
});
