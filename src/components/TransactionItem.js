// src/components/TransactionItem.js
// Свайп: удалить, изменить, дублировать. RTL-safe.
import { Feather } from '@expo/vector-icons';
import { useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import i18n from '../i18n';
import { colors } from '../theme/colors';
import Amount from './Amount';
import { getCatName } from './CategoryPickerModal';
import CategoryIcon, { getCachedGroups } from './CategoryIcon';


export default function TransactionItem({ transaction, onDelete, onEdit, onDuplicate }) {
  const swipeRef = useRef(null);
  const styles = createStyles();
  const isTransfer = !!transaction.isTransfer;
  const isIncome = transaction.type === 'income';
  const amountColor = isTransfer ? colors.blue : isIncome ? colors.green : colors.red;

  const closeSwipe = () => swipeRef.current?.close();

  const renderActions = () => (
    <View style={styles.actionsRow}>
      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: 'rgba(96,165,250,0.15)' }]}
        onPress={() => { closeSwipe(); onDuplicate?.(transaction); }}
      >
        <Feather name="copy" size={18} color={colors.blue} />
        <Text style={[styles.actionLabel, { color: colors.blue }]}>{i18n.t('copy')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: 'rgba(251,191,36,0.15)' }]}
        onPress={() => { closeSwipe(); onEdit?.(transaction); }}
      >
        <Feather name="edit-2" size={18} color={colors.yellow} />
        <Text style={[styles.actionLabel, { color: colors.yellow }]}>{i18n.t('edit')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: colors.redSoft }]}
        onPress={() => { closeSwipe(); onDelete?.(transaction); }}
      >
        <Feather name="trash-2" size={18} color={colors.red} />
        <Text style={[styles.actionLabel, { color: colors.red }]}>{i18n.t('delete')}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderActions} renderLeftActions={renderActions} overshootRight={false} overshootLeft={false}>
      <View style={styles.container}>
        <CategoryIcon categoryId={transaction.categoryId} size="medium" />
        <View style={styles.info}>
          <Text style={styles.category}>{getCatName(transaction.categoryId, getCachedGroups(), i18n.getLanguage())}</Text>
          <Text style={styles.note} numberOfLines={1}>
            {transaction.note || ''}
          </Text>
        </View>
        <View style={styles.amountContainer}>
          <Amount value={isIncome ? transaction.amount : isTransfer ? transaction.amount : -transaction.amount} sign={!isTransfer} style={styles.amount} color={amountColor} />
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

const createStyles = () => StyleSheet.create({
  container: {
    flexDirection: i18n.row(), alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: 6,
    backgroundColor: colors.card,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  info: { flex: 1 },
  category: { color: colors.text, fontSize: 15, fontWeight: '600', letterSpacing: -0.2, textAlign: i18n.textAlign() },
  note: { color: colors.textMuted, fontSize: 12, marginTop: 3, textAlign: i18n.textAlign() },
  amountContainer: { alignItems: i18n.isRTL() ? 'flex-start' : 'flex-end' },
  amount: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3, writingDirection: 'ltr' },
  date: { color: colors.textMuted, fontSize: 11, marginTop: 3, alignSelf: 'flex-end' },

  actionsRow: { flexDirection: i18n.row() },
  actionBtn: {
    width: 68, justifyContent: 'center', alignItems: 'center',
  },
  actionLabel: { fontSize: 10, fontWeight: '600', marginTop: 4 },
});