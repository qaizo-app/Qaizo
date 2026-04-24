// src/components/UpcomingPaymentsModal.js
// Full-screen view of all upcoming recurring payments for a single account,
// with a search field and an inline "history per recipient" panel. Tapping
// a row expands the last matching transactions so the user can see what
// they've actually paid to that recipient before.
//
// Transactions are matched to a recurring item by recipient first, and by
// category + amount as a fallback when no recipient was recorded.
import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import i18n from '../i18n';
import { categoryConfig, colors } from '../theme/colors';
import Amount from './Amount';
import { catName } from '../utils/categoryName';
import { getCachedGroups } from '../utils/categoryCache';
import { getCatIcon } from './CategoryPickerModal';
import { sym } from '../utils/currency';
import { matchHistory as matchRecurringHistory, summarizeHistory } from '../utils/recurringHistory';

const HISTORY_PREVIEW = 5;

function formatDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  } catch (e) { return ''; }
}

export default function UpcomingPaymentsModal({
  visible,
  onClose,
  recurring = [],
  transactions = [],
  currency,
  accounts = [],
  perspectiveAccountId,
}) {
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const st = createSt();

  const accNameById = useMemo(() => {
    const map = {};
    for (const a of accounts) map[a.id] = a.name || '';
    return map;
  }, [accounts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recurring;
    return recurring.filter(r => {
      const transferName = r.isTransfer
        ? `${accNameById[r.account] || ''} ${accNameById[r.toAccount] || ''}`
        : '';
      const name = (r.recipient || catName(r.categoryId, r.categoryName) || transferName || '').toLowerCase();
      const amt = String(r.amount || '');
      return name.includes(q) || amt.includes(q);
    });
  }, [recurring, query, accNameById]);

  const handleClose = () => {
    setQuery('');
    setExpandedId(null);
    onClose?.();
  };

  const renderItem = ({ item: rec }) => {
    const isTransferIn = rec.isTransfer && perspectiveAccountId && rec.toAccount === perspectiveAccountId;
    const isTransferOut = rec.isTransfer && perspectiveAccountId && rec.account === perspectiveAccountId;
    const savedIcon = !rec.isTransfer && rec.icon && rec.icon !== 'more-horizontal'
      ? { icon: rec.icon, color: rec.iconColor || categoryConfig[rec.categoryId]?.color || colors.textDim }
      : null;
    const fromGroups = !rec.isTransfer && !savedIcon ? getCatIcon(rec.categoryId, getCachedGroups()) : null;
    const cfg = rec.isTransfer
      ? { icon: 'repeat', color: colors.blue }
      : (savedIcon || (fromGroups && fromGroups.icon !== 'circle' ? fromGroups : categoryConfig[rec.categoryId] || categoryConfig.other));
    const nd = rec.nextDate ? new Date(rec.nextDate) : null;
    const diffDays = nd ? Math.ceil((nd - new Date()) / (1000 * 60 * 60 * 24)) : null;
    const dateLabel = diffDays == null
      ? ''
      : diffDays <= 0
        ? i18n.t('today')
        : diffDays === 1
          ? i18n.t('tomorrow')
          : `${diffDays} ${i18n.t('days')}`;
    const name = rec.isTransfer
      ? `${accNameById[rec.account] || '—'} → ${accNameById[rec.toAccount] || '—'}`
      : (rec.recipient || catName(rec.categoryId, rec.categoryName));
    const isExpanded = expandedId === rec.id;
    const history = isExpanded ? matchRecurringHistory(rec, transactions) : [];
    const historyPreview = history.slice(0, HISTORY_PREVIEW);
    const { total: totalSpent } = isExpanded ? summarizeHistory(history) : { total: 0 };

    return (
      <View style={st.card}>
        <TouchableOpacity
          style={st.row}
          onPress={() => setExpandedId(isExpanded ? null : rec.id)}
          activeOpacity={0.7}
        >
          <View style={[st.icon, { backgroundColor: cfg.color + '20' }]}>
            <Feather name={cfg.icon || 'repeat'} size={18} color={cfg.color} />
          </View>
          <View style={st.info}>
            <Text style={st.name} numberOfLines={1}>{name}</Text>
            <Text style={st.meta} numberOfLines={1}>
              <Text style={{
                color: isTransferIn ? colors.green
                  : isTransferOut ? colors.red
                  : rec.isTransfer ? colors.blue
                  : rec.type === 'expense' ? colors.red : colors.green,
              }}>
                {isTransferIn ? '+' : isTransferOut ? '-' : rec.isTransfer ? '' : (rec.type === 'expense' ? '-' : '+')}
                {Math.abs(rec.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                {currency || sym()}
              </Text>
              {dateLabel ? ` · ${dateLabel}` : ''}
            </Text>
          </View>
          <Feather
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textMuted}
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={st.historyWrap}>
            <View style={st.historyHeader}>
              <Text style={st.historyTitle}>{i18n.t('recipientHistory')}</Text>
              {history.length > 0 && (
                <Text style={st.historyTotal}>
                  {i18n.t('totalSpent')}:{' '}
                  <Amount value={totalSpent} style={st.historyTotalAmt} currency={currency} />
                </Text>
              )}
            </View>
            {history.length === 0 ? (
              <Text style={st.historyEmpty}>{i18n.t('noTransactions')}</Text>
            ) : (
              historyPreview.map(tx => (
                <View key={tx.id} style={st.histRow}>
                  <Text style={st.histDate}>{formatDate(tx.date || tx.createdAt)}</Text>
                  <Text style={[
                    st.histAmt,
                    { color: tx.type === 'income' ? colors.green : colors.red },
                  ]}>
                    {tx.type === 'income' ? '+' : '-'}
                    {Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                    {currency || sym()}
                  </Text>
                </View>
              ))
            )}
            {history.length > HISTORY_PREVIEW && (
              <Text style={st.historyMore}>
                +{history.length - HISTORY_PREVIEW} {i18n.t('more') || ''}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={st.container}
      >
        <View style={st.header}>
          <TouchableOpacity style={st.backBtn} onPress={handleClose}>
            <Feather name={i18n.backIcon()} size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={st.headerTitle}>{i18n.t('upcomingPayments')}</Text>
          <View style={st.headerSpacer} />
        </View>

        <View style={st.searchWrap}>
          <Feather name="search" size={16} color={colors.textMuted} style={st.searchIcon} />
          <TextInput
            style={st.searchInput}
            placeholder={i18n.t('search')}
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Feather name="x" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={st.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={st.empty}>
              <Feather name="inbox" size={48} color={colors.textMuted} />
              <Text style={st.emptyText}>{i18n.t('noResults')}</Text>
            </View>
          }
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createSt = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.cardBorder,
  },
  headerTitle: {
    flex: 1, color: colors.text, fontSize: 17, fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: { width: 40 },
  searchWrap: {
    flexDirection: i18n.row(), alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginVertical: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: colors.cardBorder,
  },
  searchIcon: {},
  searchInput: {
    flex: 1, color: colors.text, fontSize: 15,
    padding: 0, textAlign: i18n.textAlign(),
  },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    backgroundColor: colors.card, borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: colors.cardBorder, marginBottom: 10,
  },
  row: { flexDirection: i18n.row(), alignItems: 'center', gap: 12 },
  icon: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  info: { flex: 1 },
  name: {
    color: colors.text, fontSize: 14, fontWeight: '600',
    textAlign: i18n.textAlign(),
  },
  meta: {
    color: colors.textDim, fontSize: 12, marginTop: 2,
    writingDirection: 'ltr',
  },
  historyWrap: {
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: colors.divider,
  },
  historyHeader: {
    flexDirection: i18n.row(), justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  historyTitle: {
    color: colors.textDim, fontSize: 12, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  historyTotal: { color: colors.textDim, fontSize: 12 },
  historyTotalAmt: { color: colors.text, fontWeight: '700' },
  histRow: {
    flexDirection: i18n.row(), justifyContent: 'space-between',
    paddingVertical: 6,
  },
  histDate: { color: colors.textDim, fontSize: 13 },
  histAmt: { fontSize: 13, fontWeight: '600' },
  historyEmpty: {
    color: colors.textMuted, fontSize: 13, fontStyle: 'italic',
    paddingVertical: 8, textAlign: 'center',
  },
  historyMore: {
    color: colors.textMuted, fontSize: 12, marginTop: 4,
    textAlign: 'center',
  },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: colors.textMuted, fontSize: 14, marginTop: 12 },
});
