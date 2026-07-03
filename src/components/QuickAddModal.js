// src/components/QuickAddModal.js
// Быстрый ввод: категория выбрана, вводим сумму + выбираем счёт.
// На SwipeModal (как AddTransactionModal) — чтобы пикер счёта был соседним
// слоем, а не вложенным в нативный Modal (иначе список счетов обрезался).
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { accountTypeConfig, colors } from '../theme/colors';
import { sym } from '../utils/currency';
import { catName } from '../utils/categoryName';
import { getCachedGroups } from '../utils/categoryCache';
import { getCatIcon, CatIcon } from './CategoryPickerModal';
import AccountPickerModal from './AccountPickerModal';
import SwipeModal from './SwipeModal';
import RowText from './RowText';

export default function QuickAddModal({ visible, template, onClose, onSaved }) {
  // ВСЕ хуки — в самом верху, до любых условий
  const [amount, setAmount] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [selAcc, setSelAcc] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState(false);
  const [showAccPicker, setShowAccPicker] = useState(false);
  const inputRef = useRef(null);
  const st = createSt();

  useEffect(() => {
    if (!visible) return;
    setAmount('');
    setSaveErr(false);
    dataService.getAccounts().then(accs => {
      const active = accs.filter(a => a.isActive !== false && ['cash', 'bank', 'credit'].includes(a.type));
      setAccounts(active);
      // Use template account if set, otherwise first account
      if (template?.account && active.some(a => a.id === template.account)) {
        setSelAcc(template.account);
      } else if (active.length > 0 && !selAcc) {
        setSelAcc(active[0].id);
      }
    });
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, [visible]);

  // Early return ПОСЛЕ всех хуков
  if (!template) return null;

  const cfg = getCatIcon(template.categoryId, getCachedGroups());
  const getAccIcon = (t) => (accountTypeConfig[t] || accountTypeConfig.bank).icon;
  const canSave = !!amount && parseFloat(amount.replace(',', '.')) > 0 && !saving;

  const handleSave = async () => {
    const num = parseFloat(amount.replace(',', '.'));
    if (!num || num <= 0 || saving) return;
    setSaving(true);
    setSaveErr(false);

    try {
      // addTransaction is bounded by withTimeout — always settles. On failure
      // it returns null, so keep the modal open instead of losing the entry.
      const r = await dataService.addTransaction({
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
      if (!r) { setSaveErr(true); return; }
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SwipeModal
        visible={visible}
        onClose={onClose}
        footer={({ close }) => (
          <View style={st.buttons}>
            <TouchableOpacity style={st.cancelBtn} onPress={close}>
              <Text style={st.cancelTxt}>{i18n.t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.saveBtn, { backgroundColor: cfg.color, opacity: canSave ? 1 : 0.35 }]}
              onPress={handleSave}
              disabled={!canSave}>
              <Feather name="check" size={18} color={colors.bg} style={{ marginEnd: 6 }} />
              <Text style={st.saveTxt}>{saving ? '...' : i18n.t('save')}</Text>
            </TouchableOpacity>
          </View>
        )}
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={st.header}>
            <View style={[st.iconWrap, { backgroundColor: cfg.color + '20' }]}>
              <CatIcon icon={cfg.icon} size={22} color={cfg.color} />
            </View>
            <Text style={st.title}>{catName(template.categoryId, template.name)}</Text>
          </View>

          {/* Сумма */}
          <View style={st.inputRow}>
            <Text style={[st.currency, { color: cfg.color, fontSize: amtFont(amount, 24) }]}>{sym()}</Text>
            <TextInput
              ref={inputRef}
              style={[st.input, { fontSize: amtFont(amount, 24), textAlign: i18n.textAlign() }]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
          </View>

          {/* Выбор счёта — дропдаун (консистентно с транзакциями) */}
          <Text style={st.label}>{i18n.t('payFrom')}</Text>
          {(() => {
            const sel = accounts.find(a => a.id === selAcc);
            const accCfg = accountTypeConfig[sel?.type] || accountTypeConfig.bank;
            return (
              <TouchableOpacity style={st.accPickBtn} onPress={() => setShowAccPicker(true)} activeOpacity={0.7}>
                <MaterialCommunityIcons name={getAccIcon(sel?.type)} size={16} color={sel ? accCfg.color : colors.textMuted} />
                <RowText style={[st.accPickTxt, !sel && { color: colors.textMuted }]} numberOfLines={1}>{sel?.name || '—'}</RowText>
                <Feather name="chevron-down" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            );
          })()}

          {saveErr && <RowText style={st.saveErr}>{i18n.t('saveFailed')}</RowText>}
        </ScrollView>
      </SwipeModal>

      <AccountPickerModal
        visible={showAccPicker}
        onClose={() => setShowAccPicker(false)}
        accounts={accounts}
        selectedId={selAcc}
        onSelect={(id) => setSelAcc(id)}
        title={i18n.t('payFrom')}
      />
    </>
  );
}

function amtFont(val, base) {
  const len = (val || '').length;
  if (len <= 4) return base;
  if (len <= 6) return Math.round(base * 0.8);
  return Math.round(base * 0.65);
}

const createSt = () => StyleSheet.create({
  header: { flexDirection: i18n.row(), alignItems: 'center', marginBottom: 20, gap: 14 },
  iconWrap: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', textAlign: i18n.textAlign() },
  inputRow: { flexDirection: i18n.row(), alignItems: 'center', backgroundColor: colors.bg2, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, paddingHorizontal: 16, marginBottom: 16 },
  currency: { fontSize: 24, fontWeight: '700', marginEnd: 8 },
  input: { flex: 1, color: colors.text, fontSize: 24, fontWeight: '700', paddingVertical: 16 },
  label: { color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8, textAlign: i18n.textAlign() },
  accPickBtn: { flexDirection: i18n.row(), alignItems: 'center', backgroundColor: colors.bg2, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 20, borderWidth: 1, borderColor: colors.cardBorder, gap: 8 },
  accPickTxt: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600', textAlign: i18n.textAlign() },
  buttons: { flexDirection: i18n.row(), gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, alignItems: 'center' },
  cancelTxt: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  saveBtn: { flex: 1, flexDirection: i18n.row(), paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  saveTxt: { color: colors.bg, fontSize: 14, fontWeight: '700' },
  saveErr: { color: colors.red, fontSize: 13, fontWeight: '600', textAlign: i18n.textAlign(), marginBottom: 10 },
});
