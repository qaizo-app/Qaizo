// src/components/ConfirmRecurringModal.js
// Confirmation sheet for a scheduled payment. Before marking a recurring
// payment as paid-or-skipped the user can tweak the amount, pick a
// different payment date, and (for transfers) change the source / target
// accounts. Two actions at the bottom — "Skip" shifts the next-occurrence
// date forward, "Confirm" materializes the transaction with overrides.
//
// Auto-confirm on load still runs silently in the Dashboard; this modal
// is only surfaced for the manual flow where the user taps confirm/skip.
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { accountTypeConfig, categoryConfig, colors } from '../theme/colors';
import Amount from './Amount';
import DatePickerModal from './DatePickerModal';
import SwipeModal from './SwipeModal';
import { catName } from '../utils/categoryName';
import { getCachedGroups } from '../utils/categoryCache';
import { getCatIcon } from './CategoryPickerModal';
import { sym } from '../utils/currency';

function isoToDisplayDate(iso, lang) {
  if (!iso) return '';
  const d = new Date(iso);
  const monthNames = {
    ru: ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'],
    he: ['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ'],
    en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  };
  const m = (monthNames[lang] || monthNames.en)[d.getMonth()];
  return `${d.getDate()} ${m} ${d.getFullYear()}`;
}

export default function ConfirmRecurringModal({ visible, item, onClose, onConfirm }) {
  const [amount, setAmount] = useState('');
  const [dateIso, setDateIso] = useState('');
  const [selAcc, setSelAcc] = useState('');
  const [toAcc, setToAcc] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const st = createSt();

  useEffect(() => {
    if (!visible || !item) return;
    // Synchronous reset from the item so the sheet never shows stale data.
    setAmount(String(item.amount ?? ''));
    // Prefer the payment's next-due date; fall back to today for safety.
    const defaultIso = item.nextDate
      ? new Date(item.nextDate + 'T00:00:00').toISOString()
      : new Date().toISOString();
    setDateIso(defaultIso);
    setSelAcc(item.account || '');
    setToAcc(item.toAccount || '');
    setBusy(false);
    dataService.getAccounts().then(accs => {
      setAccounts(accs.filter(a => a.isActive !== false));
    });
  }, [visible, item]);

  if (!item) return null;

  const isTransfer = !!item.isTransfer;
  const typeColor = isTransfer ? colors.blue : item.type === 'expense' ? colors.red : colors.green;
  const savedIcon = !isTransfer && item.icon && item.icon !== 'more-horizontal' && item.icon !== 'repeat'
    ? { icon: item.icon, color: item.iconColor || categoryConfig[item.categoryId]?.color || colors.textDim }
    : null;
  const fromGroups = !isTransfer && !savedIcon ? getCatIcon(item.categoryId, getCachedGroups()) : null;
  const cfg = isTransfer
    ? { icon: 'repeat', color: colors.blue }
    : (savedIcon || (fromGroups && fromGroups.icon !== 'circle' ? fromGroups : categoryConfig[item.categoryId] || categoryConfig.other));
  const displayName = isTransfer
    ? `${accounts.find(a => a.id === selAcc)?.name || '—'} → ${accounts.find(a => a.id === toAcc)?.name || '—'}`
    : (item.recipient || catName(item.categoryId, item.categoryName));

  const parsedAmount = parseFloat(String(amount).replace(',', '.'));
  const amountValid = !isNaN(parsedAmount) && parsedAmount > 0;
  const transferValid = !isTransfer || (selAcc && toAcc && selAcc !== toAcc);
  const canConfirm = amountValid && selAcc && transferValid;
  const getAI = (t) => (accountTypeConfig[t] || accountTypeConfig.bank).icon;

  const runConfirm = async () => {
    if (!canConfirm || busy) return;
    setBusy(true);
    try {
      await onConfirm?.(item.id, {
        amount: parsedAmount,
        date: dateIso,
        account: selAcc,
        toAccount: isTransfer ? toAcc : null,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SwipeModal
        visible={visible}
        onClose={onClose}
        footer={({ close }) => (
          <View style={st.btnRow}>
            <TouchableOpacity
              style={st.cancelBtn}
              onPress={close}
              disabled={busy}
            >
              <Text style={st.cancelTxt}>{i18n.t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.confirmBtn, { backgroundColor: typeColor, opacity: canConfirm && !busy ? 1 : 0.4 }]}
              onPress={runConfirm}
              disabled={!canConfirm || busy}
            >
              <Feather name="check" size={18} color="#fff" style={{ marginEnd: 6 }} />
              <Text style={st.confirmTxt}>{i18n.t('confirm')}</Text>
            </TouchableOpacity>
          </View>
        )}
      >
        {({ close }) => (
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={st.headerRow}>
              <View style={[st.icon, { backgroundColor: cfg.color + '20' }]}>
                <Feather name={cfg.icon || 'repeat'} size={20} color={cfg.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.title}>{i18n.t('confirm')}</Text>
                <Text style={st.subtitle} numberOfLines={1}>{displayName}</Text>
              </View>
            </View>

            {/* Amount */}
            <Text style={st.label}>{i18n.t('amount')}</Text>
            <Text style={[st.amtLine, { textAlign: i18n.textAlign() }]}>
              <TextInput
                style={[st.amtIn, { fontSize: amtFont(amount, 28), color: typeColor }]}
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />
              <Text style={[st.cur, { color: typeColor, fontSize: amtFont(amount, 28) }]}>{' '}{sym()}</Text>
            </Text>

            {/* Date */}
            <Text style={st.label}>{i18n.t('date') || 'Date'}</Text>
            <TouchableOpacity style={st.row} onPress={() => setShowDatePicker(true)}>
              <Feather name="calendar" size={18} color={colors.textDim} />
              <Text style={st.rowTxt}>{isoToDisplayDate(dateIso, i18n.getLanguage())}</Text>
              <Feather name={i18n.chevronRight()} size={16} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Accounts */}
            {isTransfer ? (
              <>
                <Text style={st.label}>{i18n.t('from')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {accounts.filter(a => ['cash', 'bank', 'credit', 'investment', 'crypto', 'asset'].includes(a.type)).map(acc => {
                    const sl = selAcc === acc.id;
                    return (
                      <TouchableOpacity key={acc.id}
                        style={[st.chip, sl && { borderColor: colors.red, backgroundColor: `${colors.red}10` }]}
                        onPress={() => setSelAcc(acc.id)}>
                        <MaterialCommunityIcons name={getAI(acc.type)} size={14} color={sl ? colors.red : colors.textMuted} />
                        <Text style={[st.chipTxt, sl && { color: colors.text }]} numberOfLines={1}>{acc.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <Text style={st.label}>{i18n.t('to')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {accounts.filter(a => ['cash', 'bank', 'credit'].includes(a.type) && a.id !== selAcc).map(acc => {
                    const sl = toAcc === acc.id;
                    return (
                      <TouchableOpacity key={acc.id}
                        style={[st.chip, sl && { borderColor: colors.blue, backgroundColor: colors.blueSoft }]}
                        onPress={() => setToAcc(acc.id)}>
                        <MaterialCommunityIcons name={getAI(acc.type)} size={14} color={sl ? colors.blue : colors.textMuted} />
                        <Text style={[st.chipTxt, sl && { color: colors.text }]} numberOfLines={1}>{acc.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            ) : (
              <>
                <Text style={st.label}>{i18n.t('account')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {accounts
                    .filter(acc => item.type === 'income' ? ['cash', 'bank', 'investment', 'crypto', 'asset'].includes(acc.type) : ['cash', 'bank', 'credit'].includes(acc.type))
                    .map(acc => {
                      const sl = selAcc === acc.id;
                      return (
                        <TouchableOpacity key={acc.id}
                          style={[st.chip, sl && { borderColor: typeColor, backgroundColor: `${typeColor}10` }]}
                          onPress={() => setSelAcc(acc.id)}>
                          <MaterialCommunityIcons name={getAI(acc.type)} size={14} color={sl ? typeColor : colors.textMuted} />
                          <Text style={[st.chipTxt, sl && { color: colors.text }]} numberOfLines={1}>{acc.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                </ScrollView>
              </>
            )}
          </ScrollView>
        )}
      </SwipeModal>

      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelect={(iso) => { setDateIso(iso); setShowDatePicker(false); }}
        selectedDate={dateIso}
        lang={i18n.getLanguage()}
      />
    </>
  );
}

function amtFont(val, base) {
  const len = String(val || '').length;
  if (len <= 4) return base;
  if (len <= 6) return Math.round(base * 0.8);
  return Math.round(base * 0.65);
}

const createSt = () => StyleSheet.create({
  headerRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 12, marginBottom: 16 },
  icon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  title: { color: colors.text, fontSize: 18, fontWeight: '700', textAlign: i18n.textAlign() },
  subtitle: { color: colors.textDim, fontSize: 13, marginTop: 2, textAlign: i18n.textAlign() },
  label: {
    color: colors.textDim, fontSize: 11, fontWeight: '700',
    letterSpacing: 1, marginBottom: 6, marginTop: 4, textAlign: i18n.textAlign(),
  },
  // Nested TextInput inside Text so the currency symbol sits inline with the
  // typed number instead of being pushed to the other edge by row stretching.
  amtLine: { marginBottom: 14 },
  cur: { fontSize: 28, fontWeight: '800' },
  amtIn: { minWidth: 40, color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -1, padding: 0 },
  row: {
    flexDirection: i18n.row(), alignItems: 'center', gap: 12,
    backgroundColor: colors.card, borderRadius: 14, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: colors.cardBorder,
  },
  rowTxt: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600', textAlign: i18n.textAlign() },
  chip: {
    flexDirection: i18n.row(), alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: colors.card, marginEnd: 8,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  chipTxt: { color: colors.textDim, fontSize: 12, fontWeight: '500', marginStart: 6, maxWidth: 100 },
  btnRow: { flexDirection: i18n.row(), gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 14,
    backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.cardBorder,
  },
  cancelTxt: { color: colors.textDim, fontSize: 15, fontWeight: '700' },
  confirmBtn: {
    flex: 1, flexDirection: i18n.row(), paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'transparent',
  },
  confirmTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
