// src/components/AddTransactionModal.js
// ЗАМЕНИ полностью — счёт для всех типов, сортировка по частоте
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { colors } from '../theme/colors';
 
const EXPENSE_CATEGORIES = [
  { id: 'food', icon: '🛒' },
  { id: 'restaurant', icon: '🍽️' },
  { id: 'transport', icon: '🚗' },
  { id: 'fuel', icon: '⛽' },
  { id: 'health', icon: '🏥' },
  { id: 'phone', icon: '📱' },
  { id: 'utilities', icon: '💡' },
  { id: 'clothing', icon: '👕' },
  { id: 'household', icon: '🏡' },
  { id: 'kids', icon: '👶' },
  { id: 'entertainment', icon: '🎬' },
  { id: 'education', icon: '📚' },
  { id: 'cosmetics', icon: '💄' },
  { id: 'electronics', icon: '🔌' },
  { id: 'insurance', icon: '🛡️' },
  { id: 'rent', icon: '🏠' },
  { id: 'arnona', icon: '🏘️' },
  { id: 'vaad', icon: '🏢' },
  { id: 'other', icon: '📋' },
];
 
const INCOME_CATEGORIES = [
  { id: 'salary_me', icon: '💼' },
  { id: 'salary_spouse', icon: '💼' },
  { id: 'rental_income', icon: '🏠' },
  { id: 'handyman', icon: '🔧' },
  { id: 'sales', icon: '📦' },
  { id: 'other_income', icon: '💰' },
];
 
export default function AddTransactionModal({ visible, onClose, onSave }) {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('food');
  const [categoryIcon, setCategoryIcon] = useState('🛒');
  const [note, setNote] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [transactions, setTransactions] = useState([]);
 
  useEffect(() => {
    if (visible) {
      Promise.all([
        dataService.getAccounts(),
        dataService.getTransactions(),
      ]).then(([accs, txs]) => {
        // Sort accounts by usage frequency
        const usageCount = {};
        txs.forEach(tx => {
          const accId = tx.account || '';
          usageCount[accId] = (usageCount[accId] || 0) + 1;
        });
        const sorted = [...accs].sort((a, b) => (usageCount[b.id] || 0) - (usageCount[a.id] || 0));
        setAccounts(sorted);
        setTransactions(txs);
        if (sorted.length > 0) {
          setSelectedAccount(sorted[0].id);
          if (sorted.length > 1) setToAccount(sorted[1].id);
        }
      });
      setAmount('');
      setNote('');
      setType('expense');
      setCategoryId('food');
      setCategoryIcon('🛒');
    }
  }, [visible]);
 
  const currentCategories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
 
  const handleTypeChange = (newType) => {
    setType(newType);
    if (newType === 'income') {
      setCategoryId('salary_me');
      setCategoryIcon('💼');
    } else if (newType === 'expense') {
      setCategoryId('food');
      setCategoryIcon('🛒');
    }
  };
 
  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
 
    if (type === 'transfer') {
      if (selectedAccount === toAccount) return;
      const fromName = accounts.find(a => a.id === selectedAccount)?.name || '';
      const toName = accounts.find(a => a.id === toAccount)?.name || '';
      await dataService.addTransaction({
        type: 'expense', amount: parseFloat(amount), categoryId: 'transfer', icon: '🔄',
        note: note || `→ ${toName}`, currency: '₪', date: new Date().toISOString(),
        account: selectedAccount, isTransfer: true,
      });
      await dataService.addTransaction({
        type: 'income', amount: parseFloat(amount), categoryId: 'transfer', icon: '🔄',
        note: note || `← ${fromName}`, currency: '₪', date: new Date().toISOString(),
        account: toAccount, isTransfer: true,
      });
    } else {
      await dataService.addTransaction({
        type, amount: parseFloat(amount), categoryId, icon: categoryIcon,
        note, currency: '₪', date: new Date().toISOString(), account: selectedAccount,
      });
    }
    onSave?.();
    onClose?.();
  };
 
  const accountLabel = type === 'expense'
    ? (i18n.getLanguage() === 'ru' ? 'Откуда списать' : i18n.getLanguage() === 'he' ? 'מאיפה' : 'Pay from')
    : type === 'income'
    ? (i18n.getLanguage() === 'ru' ? 'Куда зачислить' : i18n.getLanguage() === 'he' ? 'לאן' : 'Receive to')
    : (i18n.getLanguage() === 'ru' ? 'Откуда' : i18n.getLanguage() === 'he' ? 'מחשבון' : 'From');
 
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modal}>
          <View style={styles.handle} />
 
          {/* Type Toggle */}
          <View style={styles.typeRow}>
            {['expense', 'income', 'transfer'].map(t => {
              const isActive = type === t;
              const label = t === 'expense' ? i18n.t('expenseType')
                : t === 'income' ? i18n.t('incomeType') : i18n.t('transfer');
              const activeStyle = t === 'expense' ? styles.typeActiveExpense
                : t === 'income' ? styles.typeActiveIncome : styles.typeActiveTransfer;
              return (
                <TouchableOpacity key={t} style={[styles.typeBtn, isActive && activeStyle]}
                  onPress={() => handleTypeChange(t)}>
                  <Text style={[styles.typeBtnText, isActive && styles.typeBtnTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
 
          {/* Amount */}
          <View style={styles.amountRow}>
            <Text style={[styles.currency, {
              color: type === 'income' ? colors.green : type === 'expense' ? colors.red : colors.blue
            }]}>₪</Text>
            <TextInput style={styles.amountInput} value={amount} onChangeText={setAmount}
              placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" autoFocus />
          </View>
 
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 340 }}>
 
            {/* Account: FROM (all types) */}
            <Text style={styles.sectionLabel}>{accountLabel}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountsScroll}>
              {accounts.map((acc, idx) => {
                const isSelected = selectedAccount === acc.id;
                const borderColor = type === 'expense' ? colors.red : type === 'income' ? colors.green : colors.blue;
                return (
                  <TouchableOpacity key={acc.id}
                    style={[styles.accountChip, isSelected && { borderColor, backgroundColor: `${borderColor}11` }]}
                    onPress={() => setSelectedAccount(acc.id)}>
                    <Text style={styles.accountIcon}>{acc.icon}</Text>
                    <Text style={[styles.accountName, isSelected && { color: colors.text }]} numberOfLines={1}>
                      {acc.name}
                    </Text>
                    {idx < 3 && <View style={[styles.freqDot, { backgroundColor: borderColor }]} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
 
            {/* Account: TO (transfer only) */}
            {type === 'transfer' && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 14 }]}>
                  {i18n.getLanguage() === 'ru' ? 'Куда' : i18n.getLanguage() === 'he' ? 'לאן' : 'To'}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountsScroll}>
                  {accounts.filter(a => a.id !== selectedAccount).map(acc => (
                    <TouchableOpacity key={acc.id}
                      style={[styles.accountChip, toAccount === acc.id && { borderColor: colors.blue, backgroundColor: 'rgba(96,165,250,0.08)' }]}
                      onPress={() => setToAccount(acc.id)}>
                      <Text style={styles.accountIcon}>{acc.icon}</Text>
                      <Text style={[styles.accountName, toAccount === acc.id && { color: colors.text }]} numberOfLines={1}>
                        {acc.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
 
            {/* Categories (expense/income only) */}
            {type !== 'transfer' && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 14 }]}>{i18n.t('category')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
                  {currentCategories.map(cat => (
                    <TouchableOpacity key={cat.id}
                      style={[styles.catBtn, categoryId === cat.id && styles.catBtnActive]}
                      onPress={() => { setCategoryId(cat.id); setCategoryIcon(cat.icon); }}>
                      <Text style={styles.catIcon}>{cat.icon}</Text>
                      <Text style={[styles.catLabel, categoryId === cat.id && styles.catLabelActive]} numberOfLines={1}>
                        {i18n.t(cat.id)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
 
            {/* Note */}
            <TextInput style={styles.noteInput} value={note} onChangeText={setNote}
              placeholder={i18n.t('note')} placeholderTextColor={colors.textMuted} />
          </ScrollView>
 
          {/* Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>{i18n.t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, {
                backgroundColor: type === 'income' ? colors.green : type === 'expense' ? colors.red : colors.blue,
                opacity: amount && parseFloat(amount) > 0 ? 1 : 0.35,
              }]}
              onPress={handleSave} disabled={!amount || parseFloat(amount) <= 0}>
              <Text style={styles.saveText}>{i18n.t('save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
 
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modal: {
    backgroundColor: colors.bg2, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36, maxHeight: '90%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.textMuted, alignSelf: 'center', marginBottom: 24, opacity: 0.4 },
 
  typeRow: { flexDirection: 'row', gap: 0, marginBottom: 24, backgroundColor: colors.card, borderRadius: 14, padding: 4 },
  typeBtn: { flex: 1, paddingVertical: 12, borderRadius: 11, alignItems: 'center' },
  typeActiveExpense: { backgroundColor: colors.redSoft, borderWidth: 1, borderColor: 'rgba(251,113,133,0.3)' },
  typeActiveIncome: { backgroundColor: colors.greenSoft, borderWidth: 1, borderColor: 'rgba(52,211,153,0.3)' },
  typeActiveTransfer: { backgroundColor: 'rgba(96,165,250,0.10)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.3)' },
  typeBtnText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  typeBtnTextActive: { color: colors.text },
 
  amountRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingHorizontal: 4 },
  currency: { fontSize: 36, fontWeight: '800', marginRight: 8 },
  amountInput: { flex: 1, color: colors.text, fontSize: 42, fontWeight: '800', letterSpacing: -1 },
 
  sectionLabel: { color: colors.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  accountsScroll: { marginBottom: 4 },
  accountChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, backgroundColor: colors.card, marginRight: 8,
    borderWidth: 1.5, borderColor: 'transparent', minWidth: 80,
  },
  accountIcon: { fontSize: 18, marginRight: 6 },
  accountName: { color: colors.textDim, fontSize: 13, fontWeight: '500', maxWidth: 90 },
  freqDot: { width: 5, height: 5, borderRadius: 3, marginLeft: 6, opacity: 0.6 },
 
  categoriesScroll: { marginBottom: 12, maxHeight: 90 },
  catBtn: {
    alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14,
    backgroundColor: colors.card, marginRight: 8, borderWidth: 1.5, borderColor: 'transparent', minWidth: 72,
  },
  catBtnActive: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  catIcon: { fontSize: 24, marginBottom: 4 },
  catLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '500' },
  catLabelActive: { color: colors.green, fontWeight: '600' },
 
  noteInput: {
    backgroundColor: colors.card, borderRadius: 14, padding: 16, color: colors.text, fontSize: 15,
    marginTop: 8, marginBottom: 16, borderWidth: 1, borderColor: colors.cardBorder,
  },
 
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1, paddingVertical: 18, borderRadius: 14, backgroundColor: colors.card,
    alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder,
  },
  cancelText: { color: colors.textDim, fontSize: 16, fontWeight: '600' },
  saveBtn: { flex: 2, paddingVertical: 18, borderRadius: 14, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
 