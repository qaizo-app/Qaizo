// src/components/BudgetModal.js
// Модал для установки месячного лимита бюджета по категории

import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, KeyboardAvoidingView, Modal, PanResponder, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import i18n from '../i18n';
import { categoryConfig, colors } from '../theme/colors';
import { sym } from '../utils/currency';

export default function BudgetModal({ visible, categoryId, currentLimit, spent, onSave, onDelete, onClose }) {
  const [value, setValue] = useState('');
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef(null);
  const st = createSt();

  useEffect(() => {
    if (visible) {
      setValue(currentLimit > 0 ? String(currentLimit) : '');
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, damping: 25, stiffness: 300, useNativeDriver: true }),
      ]).start(() => {
        setTimeout(() => inputRef.current?.focus(), 100);
      });
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 300, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
    onPanResponderMove: (_, g) => { if (g.dy > 0) slideAnim.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 60 || g.vy > 0.3) {
        Animated.timing(slideAnim, { toValue: 300, duration: 150, useNativeDriver: true }).start(() => onClose());
      } else {
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
      }
    },
  })).current;

  const cfg = categoryConfig[categoryId] || categoryConfig.other;
  const catName = i18n.t(categoryId) || categoryId;
  const pct = currentLimit > 0 ? Math.round((spent / currentLimit) * 100) : 0;

  const handleSave = () => {
    const num = parseInt(value.replace(',', '.'), 10);
    if (num > 0) {
      onSave(categoryId, num);
    }
    onClose();
  };

  const handleDelete = () => {
    onDelete(categoryId);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior='padding'>
      <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); onClose(); }}>
        <Animated.View style={[st.overlay, { opacity: fadeAnim }]}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <Animated.View style={[st.sheet, { transform: [{ translateY: slideAnim }] }]}>
              <View {...panResponder.panHandlers} style={st.handleZone}>
                <View style={st.handle} />
              </View>
              <View style={st.header}>
                <View style={[st.iconWrap, { backgroundColor: cfg.color + '20' }]}>
                  <Feather name={cfg.icon} size={20} color={cfg.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.title}>{catName}</Text>
                  <Text style={st.spentLabel}>
                    {i18n.t('spent')}: {(spent || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()}
                    {currentLimit > 0 ? ` / ${currentLimit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${sym()} (${pct}%)` : ''}
                  </Text>
                </View>
              </View>

              {/* Поле ввода */}
              <View style={st.inputRow}>
                <Text style={st.currency}>{sym()}</Text>
                <TextInput
                  ref={inputRef}
                  style={st.input}
                  value={value}
                  onChangeText={setValue}
                  placeholder={i18n.t('budgetPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />
              </View>

              {/* Кнопка удаления — отдельная строка */}
              {currentLimit > 0 && (
                <TouchableOpacity style={st.deleteBtn} onPress={handleDelete}>
                  <Feather name="trash-2" size={16} color={colors.red} />
                  <Text style={st.deleteTxt}>{i18n.t('removeBudget')}</Text>
                </TouchableOpacity>
              )}

              {/* Кнопки Отмена / Сохранить — всегда внизу, полная ширина */}
              <View style={st.buttons}>
                <TouchableOpacity style={st.cancelBtn} onPress={onClose}>
                  <Text style={st.cancelTxt}>{i18n.t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.saveBtn} onPress={handleSave}>
                  <Text style={st.saveTxt}>{i18n.t('save')}</Text>
                </TouchableOpacity>
              </View>

            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createSt = () => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.textMuted, opacity: 0.5, alignSelf: 'center' },
  handleZone: { height: 28, justifyContent: 'center', marginBottom: 8 },

  header: { flexDirection: i18n.row(), alignItems: 'center', marginBottom: 24 },
  iconWrap: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginEnd: 14 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  spentLabel: { color: colors.textDim, fontSize: 12, marginTop: 2 },

  inputRow: { flexDirection: i18n.row(), alignItems: 'center', backgroundColor: colors.bg2, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, paddingHorizontal: 16, marginBottom: 20 },
  currency: { color: colors.green, fontSize: 20, fontWeight: '700', marginEnd: 8 },
  input: { flex: 1, color: colors.text, fontSize: 20, fontWeight: '700', paddingVertical: 16 },

  deleteBtn: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14, backgroundColor: colors.redSoft, marginBottom: 16 },
  deleteTxt: { color: colors.red, fontSize: 16, fontWeight: '600' },

  buttons: { flexDirection: i18n.row(), gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, alignItems: 'center' },
  cancelTxt: { color: colors.textDim, fontSize: 16, fontWeight: '600' },
  saveBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center' },
  saveTxt: { color: colors.bg, fontSize: 16, fontWeight: '700' },
});