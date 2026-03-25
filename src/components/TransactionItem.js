// src/components/TransactionItem.js
// Свайп влево: удалить, изменить, дублировать. Векторные иконки.
import { Feather } from '@expo/vector-icons';
import { useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import i18n from '../i18n';
import { colors } from '../theme/colors';
import CategoryIcon from './CategoryIcon';
 
export default function TransactionItem({ transaction, onDelete, onEdit, onDuplicate }) {
  const swipeRef = useRef(null);
  const isIncome = transaction.type === 'income';
  const sign = isIncome ? '+' : '-';
  const amountColor = isIncome ? colors.green : colors.red;
 
  const closeSwipe = () => swipeRef.current?.close();
 
  const renderRightActions = () => (
    <View style={styles.actionsRow}>
      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: 'rgba(96,165,250,0.15)' }]}
        onPress={() => { closeSwipe(); onDuplicate?.(transaction); }}
      >
        <Feather name="copy" size={18} color={colors.blue} />
        <Text style={[styles.actionLabel, { color: colors.blue }]}>
          {i18n.getLanguage() === 'ru' ? 'Копия' : i18n.getLanguage() === 'he' ? 'שכפול' : 'Copy'}
        </Text>
      </TouchableOpacity>
 
      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: 'rgba(251,191,36,0.15)' }]}
        onPress={() => { closeSwipe(); onEdit?.(transaction); }}
      >
        <Feather name="edit-2" size={18} color={colors.yellow} />
        <Text style={[styles.actionLabel, { color: colors.yellow }]}>
          {i18n.getLanguage() === 'ru' ? 'Изм.' : i18n.getLanguage() === 'he' ? 'עריכה' : 'Edit'}
        </Text>
      </TouchableOpacity>
 
      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: colors.redSoft }]}
        onPress={() => { closeSwipe(); onDelete?.(transaction); }}
      >
        <Feather name="trash-2" size={18} color={colors.red} />
        <Text style={[styles.actionLabel, { color: colors.red }]}>
          {i18n.getLanguage() === 'ru' ? 'Удал.' : i18n.getLanguage() === 'he' ? 'מחק' : 'Del'}
        </Text>
      </TouchableOpacity>
    </View>
  );
 
  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} overshootRight={false}>
      <View style={styles.container}>
        <CategoryIcon categoryId={transaction.categoryId} size="medium" />
        <View style={styles.info}>
          <Text style={styles.category}>{i18n.t(transaction.categoryId) || transaction.categoryId}</Text>
          <Text style={styles.note} numberOfLines={1}>
            {transaction.note || ''}
          </Text>
        </View>
        <View style={styles.amountContainer}>
          <Text style={[styles.amount, { color: amountColor }]}>
            {sign}{Math.abs(transaction.amount).toLocaleString()} ₪
          </Text>
          <Text style={styles.date}>{formatDate(transaction.date || transaction.createdAt)}</Text>
        </View>
      </View>
    </Swipeable>
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
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 4,
    backgroundColor: colors.card,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  info: { flex: 1, marginLeft: 14 },
  category: { color: colors.text, fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  note: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  amountContainer: { alignItems: 'flex-end' },
  amount: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  date: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
 
  actionsRow: { flexDirection: 'row' },
  actionBtn: {
    width: 68, justifyContent: 'center', alignItems: 'center',
  },
  actionLabel: { fontSize: 10, fontWeight: '600', marginTop: 4 },
});
 