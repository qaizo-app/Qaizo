// src/components/FirstTimeTooltip.js
// One-time tooltip shown on top of a target area. Dismissed automatically
// after the user taps it, persists dismissal per `storageKey` in AsyncStorage.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import { colors } from '../theme/colors';

const PREFIX = 'qaizo_tooltip_seen_';

export default function FirstTimeTooltip({ storageKey, text, icon = 'info', position = 'bottom', style }) {
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem(PREFIX + storageKey).then(v => {
      if (v !== 'true') {
        setVisible(true);
        Animated.spring(opacity, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }).start();
      }
    });
  }, [storageKey]);

  const dismiss = async () => {
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setVisible(false));
    try { await AsyncStorage.setItem(PREFIX + storageKey, 'true'); } catch (e) {}
  };

  if (!visible) return null;

  return (
    <Animated.View style={[st.container, { opacity }, style]} pointerEvents="box-none">
      <TouchableOpacity style={st.card} onPress={dismiss} activeOpacity={0.85}>
        <Feather name={icon} size={14} color={colors.green} />
        <Text style={st.text}>{text}</Text>
        <Feather name="x" size={12} color={colors.textDim} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  container: { alignSelf: 'stretch', paddingHorizontal: 20, marginBottom: 10 },
  card: {
    flexDirection: i18n.row(), alignItems: 'center', gap: 8,
    backgroundColor: colors.greenSoft,
    borderRadius: 10,
    borderWidth: 1, borderColor: `${colors.green}40`,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  text: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '500', textAlign: i18n.textAlign() },
});
