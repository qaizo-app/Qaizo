// src/components/TransactionItem.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import i18n from '../i18n';

export default function TransactionItem({ transaction, onPress }) {
  const isIncome = transaction.type === 'income';
  const sign = isIncome ? '+' : '-';
  const amountColor = isIncome ? colors.green : colors.red;

  return (
    <TouchableOpacity style={styles.container} onPress={() => onPress?.(transaction)}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{transaction.icon || '📋'}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.category}>{i18n.t(transaction.categoryId) || transaction.categoryId}</Text>
        <Text style={styles.note}>{transaction.note || transaction.account || ''}</Text>
      </View>
      <View style={styles.amountContainer}>
        <Text style={[styles.amount, { color: amountColor }]}>
          {sign}{Math.abs(transaction.amount).toLocaleString()} {transaction.currency || '₪'}
        </Text>
        <Text style={styles.date}>{formatDate(transaction.date || transaction.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return i18n.t('today');
  if (days === 1) return i18n.t('yesterday');
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(52,211,153,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  info: {
    flex: 1,
  },
  category: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  note: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
  },
  date: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
});
