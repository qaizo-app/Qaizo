// src/components/AddTransactionModal.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import i18n from '../i18n';
import dataService from '../services/dataService';

const QUICK_CATEGORIES = [
  { id: 'food', icon: '🛒' },
  { id: 'transport', icon: '🚗' },
  { id: 'fuel', icon: '⛽' },
  { id: 'restaurant', icon: '🍽️' },
  { id: 'health', icon: '🏥' },
  { id: 'phone', icon: '📱' },
  { id: 'clothing', icon: '👕' },
  { id: 'household', icon: '🏡' },
  { id: 'kids', icon: '👶' },
  { id: 'entertainment', icon: '🎬' },
  { id: 'salary_me', icon: '💼' },
  { id: 'rental_income', icon: '🏠' },
];

export default function AddTransactionModal({ visible, onClose, onSave }) {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('food');
  const [categoryIcon, setCategoryIcon] = useState('🛒');
  const [note, setNote] = useState('');

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    
    const transaction = {
      type,
      amount: parseFloat(amount),
      categoryId,
      icon: categoryIcon,
      note,
      currency: '₪',
      date: new Date().toISOString(),
      account: 'cash_ils',
    };

    const saved = await dataService.addTransaction(transaction);
    if (saved) {
      onSave?.(saved);
      setAmount('');
      setNote('');
      setCategoryId('food');
      setCategoryIcon('🛒');
      onClose?.();
    }
  };

  const selectCategory = (cat) => {
    setCategoryId(cat.id);
    setCategoryIcon(cat.icon);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.handle} />
          
          <Text style={styles.title}>{i18n.t('addTransaction')}</Text>

          {/* Type Toggle */}
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[styles.typeBtn, type === 'expense' && styles.typeBtnActiveExpense]}
              onPress={() => setType('expense')}
            >
              <Text style={[styles.typeBtnText, type === 'expense' && styles.typeBtnTextActive]}>
                {i18n.t('expenseType')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeBtn, type === 'income' && styles.typeBtnActiveIncome]}
              onPress={() => setType('income')}
            >
              <Text style={[styles.typeBtnText, type === 'income' && styles.typeBtnTextActive]}>
                {i18n.t('incomeType')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Amount */}
          <View style={styles.amountRow}>
            <Text style={styles.currency}>₪</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              autoFocus
            />
          </View>

          {/* Categories */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesRow}>
            {QUICK_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catBtn, categoryId === cat.id && styles.catBtnActive]}
                onPress={() => selectCategory(cat)}
              >
                <Text style={styles.catIcon}>{cat.icon}</Text>
                <Text style={styles.catLabel}>{i18n.t(cat.id)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Note */}
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder={i18n.t('note')}
            placeholderTextColor={colors.textMuted}
          />

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>{i18n.t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveText}>{i18n.t('save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.bg2,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  typeBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.card,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeBtnActiveExpense: {
    borderColor: colors.red,
    backgroundColor: 'rgba(248,113,113,0.1)',
  },
  typeBtnActiveIncome: {
    borderColor: colors.green,
    backgroundColor: 'rgba(52,211,153,0.1)',
  },
  typeBtnText: {
    color: colors.textDim,
    fontSize: 15,
    fontWeight: '600',
  },
  typeBtnTextActive: {
    color: colors.text,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  currency: {
    color: colors.green,
    fontSize: 32,
    fontWeight: '700',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    color: colors.text,
    fontSize: 36,
    fontWeight: '700',
  },
  categoriesRow: {
    marginBottom: 16,
  },
  catBtn: {
    alignItems: 'center',
    padding: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.card,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    minWidth: 70,
  },
  catBtnActive: {
    borderColor: colors.green,
    backgroundColor: colors.greenGlow,
  },
  catIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  catLabel: {
    color: colors.textDim,
    fontSize: 10,
  },
  noteInput: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    fontSize: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.textDim,
    fontSize: 16,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.green,
    alignItems: 'center',
  },
  saveText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: '700',
  },
});
