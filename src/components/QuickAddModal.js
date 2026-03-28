// src/components/QuickAddModal.js
// Быстрый ввод: категория выбрана, вводим сумму + выбираем счёт
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, KeyboardAvoidingView, Modal, PanResponder, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { accountTypeConfig, categoryConfig, colors } from '../theme/colors';
import { sym } from '../utils/currency';

export default function QuickAddModal({ visible, template, onClose, onSaved }) {
  // ВСЕ хуки — в самом верху, до любых условий
  const [amount, setAmount] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [selAcc, setSelAcc] = useState('');
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef(null);
  const st = createSt();

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

  useEffect(() => {
    if (visible) {
      setAmount(template?.defaultAmount ? String(template.defaultAmount) : '');
      dataService.getAccounts().then(accs => {
        const active = accs.filter(a => a.isActive !== false);
        setAccounts(active);
        if (active.length > 0 && !selAcc) setSelAcc(active[0].id);
      });
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

  // Early return ПОСЛЕ всех хуков
  if (!template) return null;

  const cfg = categoryConfig[template.categoryId] || categoryConfig.other;
  const getAccIcon = (t) => (accountTypeConfig[t] || accountTypeConfig.bank).icon;

  const handleSave = async () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) return;

    await dataService.addTransaction({
      type: 'expense',
      amount: num,
      categoryId: template.categoryId,
      icon: cfg.icon,
      recipient: template.recipient || '',
      note: '',
      currency: sym(),
      date: new Date().toISOString(),
      account: selAcc,
      tags: [],
    });

    onSaved?.();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); onClose(); }}>
        <Animated.View style={[st.overlay, { opacity: fadeAnim }]}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <Animated.View style={[st.sheet, { transform: [{ translateY: slideAnim }] }]}>
              <View {...panResponder.panHandlers} style={st.handleZone}>
                <View style={st.handle} />
              </View>
              <View style={st.header}>
                <View style={[st.iconWrap, { backgroundColor: cfg.color + '20' }]}>
                  <Feather name={cfg.icon} size={22} color={cfg.color} />
                </View>
                <Text style={st.title}>{i18n.t(template.categoryId)}</Text>
              </View>

              {/* Сумма */}
              <View style={st.inputRow}>
                <Text style={[st.currency, { color: cfg.color }]}>{sym()}</Text>
                <TextInput
                  ref={inputRef}
                  style={st.input}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />
              </View>

              {/* Выбор счёта */}
              <Text style={st.label}>{i18n.t('payFrom')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }} keyboardShouldPersistTaps="always">
                {accounts.filter(acc => ['cash', 'bank', 'credit'].includes(acc.type)).map(acc => {
                  const sel = selAcc === acc.id;
                  const accCfg = accountTypeConfig[acc.type] || accountTypeConfig.bank;
                  return (
                    <TouchableOpacity key={acc.id}
                      style={[st.accChip, sel && { borderColor: accCfg.color, backgroundColor: `${accCfg.color}10` }]}
                      onPress={() => { setSelAcc(acc.id); inputRef.current?.focus(); }}>
                      <MaterialCommunityIcons name={getAccIcon(acc.type)} size={14} color={sel ? accCfg.color : colors.textMuted} />
                      <Text style={[st.accTxt, sel && { color: colors.text }]} numberOfLines={1}>{acc.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Кнопки */}
              <View style={st.buttons}>
                <TouchableOpacity style={st.cancelBtn} onPress={onClose}>
                  <Text style={st.cancelTxt}>{i18n.t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.saveBtn, { backgroundColor: cfg.color, opacity: amount && parseFloat(amount) > 0 ? 1 : 0.35 }]}
                  onPress={handleSave}
                  disabled={!amount || parseFloat(amount) <= 0}
                >
                  <Feather name="check" size={18} color={colors.bg} style={{ marginEnd: 6 }} />
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
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.textMuted, opacity: 0.5, alignSelf: 'center' },
  handleZone: { height: 28, justifyContent: 'center', marginBottom: 8 },
  header: { flexDirection: i18n.row(), alignItems: 'center', marginBottom: 20, gap: 14 },
  iconWrap: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  title: { color: colors.text, fontSize: 18, fontWeight: '700', textAlign: i18n.textAlign() },
  inputRow: { flexDirection: i18n.row(), alignItems: 'center', backgroundColor: colors.bg2, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, paddingHorizontal: 16, marginBottom: 16 },
  currency: { fontSize: 26, fontWeight: '700', marginEnd: 8 },
  input: { flex: 1, color: colors.text, fontSize: 26, fontWeight: '700', paddingVertical: 16 },
  label: { color: colors.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8, textAlign: i18n.textAlign() },
  accChip: { flexDirection: i18n.row(), alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.bg2, marginEnd: 8, borderWidth: 1.5, borderColor: 'transparent', gap: 6 },
  accTxt: { color: colors.textDim, fontSize: 13, fontWeight: '500', maxWidth: 90 },
  buttons: { flexDirection: i18n.row(), gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, alignItems: 'center' },
  cancelTxt: { color: colors.textDim, fontSize: 15, fontWeight: '600' },
  saveBtn: { flex: 1, flexDirection: i18n.row(), paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  saveTxt: { color: colors.bg, fontSize: 15, fontWeight: '700' },
});