// src/components/SmartInputModal.js
// Умный ввод транзакций — пользователь пишет текст, ИИ разбирает
import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Keyboard, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import aiService from '../services/aiService';
import dataService from '../services/dataService';
import { categoryConfig, colors } from '../theme/colors';
import { fmt, sym } from '../utils/currency';

export default function SmartInputModal({ visible, onClose, onSaved }) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const st = createStyles();

  useEffect(() => {
    if (visible) {
      setText('');
      setParsed(null);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [visible]);

  useEffect(() => {
    if (parsed) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [parsed]);

  const [aiLoading, setAiLoading] = useState(false);

  const handleTextChange = (val) => {
    setText(val);
    if (val.length > 3) {
      const result = aiService.parseTransaction(val);
      setParsed(result);
    } else {
      setParsed(null);
    }
  };

  const handleSmartParse = async () => {
    if (text.length < 3) return;
    setAiLoading(true);
    const result = await aiService.parseTransactionSmart(text);
    setParsed(result);
    setAiLoading(false);
  };

  const handleSave = async () => {
    if (!parsed) return;
    setSaving(true);
    Keyboard.dismiss();

    const tx = {
      type: parsed.type,
      amount: parsed.amount,
      categoryId: parsed.categoryId,
      recipient: parsed.recipient || '',
      note: parsed.note || '',
      date: new Date().toISOString(),
      account: null,
    };

    await dataService.addTransaction(tx);
    setSaving(false);
    onSaved?.();
    onClose();
  };

  const cfg = parsed ? (categoryConfig[parsed.categoryId] || categoryConfig.other) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.overlay}>
        <View style={st.modal}>
          {/* Header */}
          <View style={st.header}>
            <TouchableOpacity onPress={onClose} style={st.closeBtn}>
              <Feather name="x" size={22} color={colors.textMuted} />
            </TouchableOpacity>
            <Text style={st.title}>{i18n.t('smartInput')}</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Hint */}
          <Text style={st.hint}>{i18n.t('smartInputHint')}</Text>

          {/* Input */}
          <View style={st.inputWrap}>
            <Feather name="edit-3" size={20} color={colors.green} style={{ marginStart: 16 }} />
            <TextInput
              ref={inputRef}
              style={st.input}
              value={text}
              onChangeText={handleTextChange}
              placeholder={i18n.t('smartInputPlaceholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              autoCorrect={false}
              autoComplete="off"
            />
            {text.length > 3 && (
              <TouchableOpacity style={st.aiBtn} onPress={handleSmartParse} disabled={aiLoading}>
                {aiLoading
                  ? <ActivityIndicator size="small" color={colors.green} />
                  : <Feather name="cpu" size={18} color={colors.green} />
                }
              </TouchableOpacity>
            )}
          </View>

          {/* Examples */}
          {!parsed && (
            <View style={st.examples}>
              <Text style={st.exTitle}>{i18n.t('examples')}:</Text>
              {[
                i18n.t('smartExample1'),
                i18n.t('smartExample2'),
                i18n.t('smartExample3'),
              ].map((ex, idx) => (
                <TouchableOpacity key={idx} onPress={() => handleTextChange(ex)} style={st.exRow}>
                  <Feather name="corner-down-right" size={14} color={colors.textMuted} />
                  <Text style={st.exText}>{ex}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Parsed result */}
          {parsed && (
            <Animated.View style={[st.resultCard, { opacity: fadeAnim }]}>
              <View style={st.resultHeader}>
                <View style={[st.resultIcon, { backgroundColor: cfg.color + '18' }]}>
                  <Feather name={cfg.icon} size={22} color={cfg.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.resultCategory}>{i18n.t(parsed.categoryId)}</Text>
                  {parsed.recipient ? <Text style={st.resultRecipient}>{parsed.recipient}</Text> : null}
                </View>
                <View>
                  <Text style={[st.resultAmount, { color: parsed.type === 'income' ? colors.green : colors.red }]}>
                    {parsed.type === 'income' ? '+' : '-'}{fmt(parsed.amount)}
                  </Text>
                  <Text style={st.resultType}>
                    {parsed.type === 'income' ? i18n.t('income') : i18n.t('expense')}
                  </Text>
                </View>
              </View>

              {/* Tax reserve for income */}
              {parsed.type === 'income' && parsed.amount > 0 && (
                <View style={st.taxRow}>
                  <Feather name="shield" size={14} color={colors.yellow} />
                  <Text style={st.taxText}>
                    {i18n.t('taxReserve')}: {fmt(Math.round(parsed.amount * 0.34))} ({i18n.t('maam')} + {i18n.t('tax')})
                  </Text>
                </View>
              )}

              <TouchableOpacity style={st.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
                <Feather name="check" size={20} color={colors.bg} />
                <Text style={st.saveTxt}>{saving ? '...' : i18n.t('confirm')}</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = () => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.bg2, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 40, borderWidth: 1, borderColor: colors.cardBorder, borderBottomWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  closeBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center' },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 32, marginBottom: 16 },

  inputWrap: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.cardBorder, marginHorizontal: 20, marginBottom: 16, minHeight: 56 },
  input: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 16, paddingHorizontal: 12, maxHeight: 100 },
  aiBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginTop: 8, marginEnd: 8 },

  examples: { paddingHorizontal: 24, marginBottom: 16 },
  exTitle: { color: colors.textDim, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  exText: { color: colors.textSecondary, fontSize: 14 },

  resultCard: { backgroundColor: colors.card, borderRadius: 20, marginHorizontal: 20, padding: 20, borderWidth: 1, borderColor: colors.cardBorder },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  resultIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  resultCategory: { color: colors.text, fontSize: 16, fontWeight: '700' },
  resultRecipient: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  resultAmount: { fontSize: 20, fontWeight: '800', textAlign: 'right' },
  resultType: { color: colors.textMuted, fontSize: 11, fontWeight: '600', textAlign: 'right', marginTop: 2 },

  taxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.bg2, borderRadius: 12, padding: 12, marginBottom: 16 },
  taxText: { color: colors.yellow, fontSize: 12, fontWeight: '600', flex: 1 },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.green, borderRadius: 14, paddingVertical: 16 },
  saveTxt: { color: colors.bg, fontSize: 16, fontWeight: '700' },
});
