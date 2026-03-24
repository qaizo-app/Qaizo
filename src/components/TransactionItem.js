// src/components/TransactionItem.js
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import { colors } from '../theme/colors';
 
export default function TransactionItem({ transaction, onPress }) {
  const isIncome = transaction.type === 'income';
  const sign = isIncome ? '+' : '-';
  const amountColor = isIncome ? colors.green : colors.red;
  const bgColor = isIncome ? colors.greenSoft : colors.redSoft;
  const catColor = colors.categories[transaction.categoryId] || colors.textMuted;
 
  return (
    <TouchableOpacity style={styles.container} onPress={() => onPress?.(transaction)} activeOpacity={0.7}>
      <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
        <Text style={styles.icon}>{transaction.icon || '📋'}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.category}>{i18n.t(transaction.categoryId) || transaction.categoryId}</Text>
        <Text style={styles.note} numberOfLines={1}>{transaction.note || ''}</Text>
      </View>
      <View style={styles.amountContainer}>
        <Text style={[styles.amount, { color: amountColor }]}>
          {sign}{Math.abs(transaction.amount).toLocaleString()} ₪
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
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}
 
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  icon: {
    fontSize: 22,
  },
  info: {
    flex: 1,
  },
  category: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  note: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  date: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
});
 