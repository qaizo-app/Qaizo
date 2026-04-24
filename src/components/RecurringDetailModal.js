// src/components/RecurringDetailModal.js
// Детали запланированного платежа: история, остаток, управление
import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { categoryConfig, colors } from '../theme/colors';
import Amount from './Amount';
import { getCachedGroups } from './CategoryIcon';
import { getCatIcon, getCatName } from './CategoryPickerModal';
import SwipeModal from './SwipeModal';
import { matchHistory, summarizeHistory } from '../utils/recurringHistory';

export default function RecurringDetailModal({ visible, item, onClose, onConfirm, onSkip, onDelete, onEdit }) {
  const [history, setHistory] = useState([]);
  const st = createSt();

  useEffect(() => {
    if (visible && item) {
      dataService.getTransactions().then(txs => {
        setHistory(matchHistory(item, txs));
      });
    } else {
      // Clear stale history when the sheet closes so a quick reopen with
      // a different item can't briefly render the previous one's list.
      setHistory([]);
    }
  }, [visible, item]);

  if (!item) return null;

  const savedIcon = !item.isTransfer && item.icon && item.icon !== 'more-horizontal' && item.icon !== 'repeat'
    ? { icon: item.icon, color: item.iconColor || categoryConfig[item.categoryId]?.color || colors.textDim }
    : null;
  const fromGroups = !item.isTransfer && !savedIcon ? getCatIcon(item.categoryId, getCachedGroups()) : null;
  const cfg = item.isTransfer
    ? { icon: 'repeat', color: colors.blue }
    : (savedIcon || (fromGroups && fromGroups.icon !== 'circle' ? fromGroups : categoryConfig[item.categoryId] || categoryConfig.other));
  const nextDate = item.nextDate ? new Date(item.nextDate) : null;
  const now = new Date();

  // Сколько осталось
  let remainLabel = '';
  if (item.endType === 'count' && item.totalCount) {
    const done = item.completedCount || 0;
    const left = item.totalCount - done;
    remainLabel = `${done} / ${item.totalCount} (${i18n.t('left')}: ${left})`;
  } else if (item.endType === 'date' && item.endDate) {
    const end = new Date(item.endDate);
    const monthsLeft = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
    remainLabel = `${i18n.t('until')} ${item.endDate} (~${Math.max(monthsLeft, 0)} ${i18n.t('months')})`;
  } else {
    remainLabel = i18n.t('noEnd');
  }

  // Периодичность
  const intervalLabel = item.intervalMonths === 1 ? i18n.t('everyMonth')
    : item.intervalMonths === 2 ? i18n.t('every2Months')
    : item.intervalMonths === 3 ? i18n.t('every3Months')
    : item.intervalMonths === 6 ? i18n.t('every6Months')
    : item.intervalMonths === 12 ? i18n.t('everyYear')
    : `${item.intervalMonths} ${i18n.t('months')}`;

  // Дни до следующего
  const diffDays = nextDate ? Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24)) : 0;
  const nextLabel = diffDays <= 0 ? i18n.t('today')
    : diffDays === 1 ? i18n.t('tomorrow')
    : `${diffDays} ${i18n.t('days')}`;

  const formatDate = (d) => {
    const dt = new Date(d);
    return `${dt.getDate()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`;
  };

  return (
    <SwipeModal visible={visible} onClose={onClose}>
      {({ close }) => (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Заголовок */}
          <View style={st.header}>
            <View style={[st.iconWrap, { backgroundColor: cfg.color + '20' }]}>
              <Feather name={cfg.icon || 'repeat'} size={24} color={cfg.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.title}>{item.recipient || item.categoryName || getCatName(item.categoryId, getCachedGroups(), i18n.getLanguage())}</Text>
              <Text style={st.subtitle}>{item.categoryName || getCatName(item.categoryId, getCachedGroups(), i18n.getLanguage())}</Text>
            </View>
            <Amount value={item.type === 'expense' ? -item.amount : item.amount} sign style={st.amount} color={item.type === 'expense' ? colors.red : colors.green} />
          </View>

          {/* Инфо */}
          <View style={st.infoCard}>
            <View style={st.infoRow}>
              <Feather name="repeat" size={14} color={colors.textDim} />
              <Text style={st.infoLabel}>{i18n.t('frequency')}</Text>
              <Text style={st.infoValue}>{intervalLabel}</Text>
            </View>
            <View style={st.infoDivider} />
            <View style={st.infoRow}>
              <Feather name="calendar" size={14} color={colors.textDim} />
              <Text style={st.infoLabel}>{i18n.t('nextPayment')}</Text>
              <Text style={[st.infoValue, diffDays <= 0 && { color: colors.yellow }]}>
                {nextDate ? formatDate(nextDate) : '—'} ({nextLabel})
              </Text>
            </View>
            <View style={st.infoDivider} />
            <View style={st.infoRow}>
              <Feather name="flag" size={14} color={colors.textDim} />
              <Text style={st.infoLabel}>{i18n.t('endCondition')}</Text>
              <Text style={st.infoValue}>{remainLabel}</Text>
            </View>
            {item.note ? (
              <>
                <View style={st.infoDivider} />
                <View style={st.infoRow}>
                  <Feather name="file-text" size={14} color={colors.textDim} />
                  <Text style={st.infoLabel}>{i18n.t('note')}</Text>
                  <Text style={st.infoValue}>{item.note}</Text>
                </View>
              </>
            ) : null}
          </View>

          {/* Кнопки действий */}
          <View style={st.actionsRow}>
            <TouchableOpacity style={st.actionBtn} onPress={() => { onConfirm(item.id); close(); }}>
              <Feather name="check" size={18} color={colors.green} />
              <Text style={[st.actionTxt, { color: colors.green }]}>{i18n.t('confirmPayment')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.actionBtn} onPress={() => { onSkip(item.id); close(); }}>
              <Feather name="fast-forward" size={18} color={colors.textMuted} />
              <Text style={st.actionTxt}>{i18n.t('skipPayment')}</Text>
            </TouchableOpacity>
          </View>

          {/* История */}
          <View style={st.sectionHeader}>
            <Text style={st.sectionTitle}>
              {i18n.t('paymentHistory')} ({history.length})
            </Text>
          </View>

          {history.length > 0 ? (
            <>
              {/* Stats card — total, average, span of the history */}
              {(() => {
                const { count, total, avg, first, last } = summarizeHistory(history);
                return (
                  <View style={st.statsCard}>
                    <View style={st.statCell}>
                      <Text style={st.statLabel}>{i18n.t('totalPaid')}</Text>
                      <Amount value={total} style={st.statValue} color={item.type === 'expense' ? colors.red : colors.green} />
                    </View>
                    <View style={st.statDividerV} />
                    <View style={st.statCell}>
                      <Text style={st.statLabel}>{i18n.t('avgPayment')}</Text>
                      <Amount value={avg} style={st.statValue} />
                    </View>
                    <View style={st.statDividerV} />
                    <View style={st.statCell}>
                      <Text style={st.statLabel}>{i18n.t('since')}</Text>
                      <Text style={st.statValue}>{first ? formatDate(first) : '—'}</Text>
                    </View>
                  </View>
                );
              })()}

              <View style={st.historyCard}>
                {history.map((tx, idx) => (
                  <View key={tx.id || idx} style={[st.historyRow, idx < history.length - 1 && st.historyBorder]}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.historyDate}>{formatDate(tx.date || tx.createdAt)}</Text>
                      {tx.note ? <Text style={st.historyNote} numberOfLines={1}>{tx.note}</Text> : null}
                    </View>
                    <Amount value={tx.type === 'expense' ? -tx.amount : tx.amount} sign style={st.historyAmount} color={tx.type === 'expense' ? colors.red : colors.green} />
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={st.emptyHistory}>
              <Feather name="clock" size={20} color={colors.textMuted} />
              <Text style={st.emptyTxt}>{i18n.t('noPaymentsYet')}</Text>
            </View>
          )}

          {/* Редактировать / Удалить */}
          <View style={st.bottomRow}>
            <TouchableOpacity style={st.editBtn} onPress={() => { onEdit(item); close(); }}>
              <Feather name="edit-2" size={16} color={colors.teal} />
              <Text style={[st.bottomTxt, { color: colors.teal }]}>{i18n.t('edit')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.deleteBtn} onPress={() => { onDelete(item.id); close(); }}>
              <Feather name="trash-2" size={16} color={colors.red} />
              <Text style={[st.bottomTxt, { color: colors.red }]}>{i18n.t('delete')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SwipeModal>
  );
}

const createSt = () => StyleSheet.create({
  header: { flexDirection: i18n.row(), alignItems: 'center', marginBottom: 20 },
  iconWrap: { width: 50, height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginEnd: 14 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  subtitle: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  amount: { fontSize: 20, fontWeight: '800' },

  infoCard: { backgroundColor: colors.bg2, borderRadius: 16, padding: 16, marginBottom: 16 },
  infoRow: { flexDirection: i18n.row(), alignItems: 'center', paddingVertical: 8 },
  infoLabel: { color: colors.textDim, fontSize: 12, fontWeight: '600', marginStart: 10, flex: 1 },
  infoValue: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', textAlign: 'right', maxWidth: '50%' },
  infoDivider: { height: 1, backgroundColor: colors.divider },

  actionsRow: { flexDirection: i18n.row(), gap: 10, marginBottom: 20 },
  actionBtn: { flex: 1, flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.cardBorder },
  actionTxt: { color: colors.textDim, fontSize: 14, fontWeight: '600' },

  sectionHeader: { marginBottom: 10 },
  sectionTitle: { color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  historyCard: { backgroundColor: colors.bg2, borderRadius: 14, padding: 12, marginBottom: 20 },
  historyRow: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, gap: 8 },
  historyBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  historyDate: { color: colors.textSecondary, fontSize: 14, fontWeight: '500', textAlign: i18n.textAlign() },
  historyNote: { color: colors.textMuted, fontSize: 11, marginTop: 2, textAlign: i18n.textAlign() },
  historyAmount: { fontSize: 14, fontWeight: '700' },
  statsCard: {
    flexDirection: i18n.row(), backgroundColor: colors.bg2, borderRadius: 14,
    paddingVertical: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.cardBorder,
  },
  statCell: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  statDividerV: { width: 1, backgroundColor: colors.divider, marginVertical: 4 },
  statLabel: {
    color: colors.textMuted, fontSize: 10, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  statValue: { color: colors.text, fontSize: 13, fontWeight: '700' },

  emptyHistory: { alignItems: 'center', paddingVertical: 24, gap: 8, backgroundColor: colors.bg2, borderRadius: 14, marginBottom: 20 },
  emptyTxt: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },

  bottomRow: { flexDirection: i18n.row(), gap: 12 },
  editBtn: { flex: 1, flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.teal + '18', borderWidth: 1, borderColor: colors.teal + '40' },
  deleteBtn: { flex: 1, flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.redSoft, borderWidth: 1, borderColor: colors.red + '40' },
  bottomTxt: { fontSize: 14, fontWeight: '600' },
});