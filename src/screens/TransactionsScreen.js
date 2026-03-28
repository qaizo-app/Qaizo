// src/screens/TransactionsScreen.js
// Поиск по имени, сумме, категории, получателю, заметке, тегам
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AddTransactionModal from '../components/AddTransactionModal';
import ConfirmModal from '../components/ConfirmModal';
import TransactionItem from '../components/TransactionItem';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { colors } from '../theme/colors';
import { sym } from '../utils/currency';

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editTx, setEditTx] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const styles = createStyles();

  const loadData = async () => {
    const txs = await dataService.getTransactions();
    setTransactions(txs);
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  // Фильтр по типу
  let filtered = filter === 'all' ? transactions : transactions.filter(t => t.type === filter);

  // Поиск
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(t => {
      const catName = (i18n.t(t.categoryId) || '').toLowerCase();
      const recipient = (t.recipient || '').toLowerCase();
      const note = (t.note || '').toLowerCase();
      const amount = String(t.amount);
      const tags = (t.tags || []).join(' ').toLowerCase();
      return catName.includes(q) || recipient.includes(q) || note.includes(q) || amount.includes(q) || tags.includes(q);
    });
  }

  const totalFiltered = filtered.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);

  const handleDelete = async () => {
    if (deleteTarget) {
      await dataService.deleteTransaction(deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    }
  };

  const handleDuplicate = async (tx) => {
    await dataService.addTransaction({
      ...tx, id: undefined, createdAt: undefined,
      date: new Date().toISOString(),
      note: tx.note ? `${tx.note} (copy)` : '(copy)',
    });
    await loadData();
  };

  const handleEdit = (tx) => { setEditTx(tx); };
  const handleCloseModal = () => { setShowAdd(false); setEditTx(null); };

  const toggleSearch = () => {
    if (showSearch) { setSearch(''); }
    setShowSearch(!showSearch);
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{i18n.t('transactions')}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={[styles.searchBtn, showSearch && styles.searchBtnActive]} onPress={toggleSearch}>
            <Feather name={showSearch ? 'x' : 'search'} size={18} color={showSearch ? colors.green : colors.textDim} />
          </TouchableOpacity>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{filtered.length}</Text>
          </View>
        </View>
      </View>

      {/* Search bar */}
      {showSearch && (
        <View style={styles.searchRow}>
          <Feather name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={i18n.t('searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoFocus
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Filters */}
      <View style={styles.filters}>
        {['all', 'expense', 'income'].map(f => {
          const active = filter === f;
          const label = f === 'all' ? i18n.t('all') : f === 'income' ? i18n.t('incomeType') : i18n.t('expenseType');
          const ic = f === 'all' ? 'list' : f === 'income' ? 'trending-up' : 'trending-down';
          const ac = f === 'expense' ? colors.red : f === 'income' ? colors.green : colors.blue;
          return (
            <TouchableOpacity key={f} style={[styles.filterBtn, active && { borderColor: ac, backgroundColor: `${ac}10` }]} onPress={() => setFilter(f)}>
              <Feather name={ic} size={14} color={active ? ac : colors.textMuted} style={{ marginEnd: 4 }} />
              <Text style={[styles.filterText, active && { color: ac }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Summary */}
      {filtered.length > 0 && (
        <View style={styles.summary}>
          <Text style={[styles.summaryAmount, { color: totalFiltered >= 0 ? colors.green : colors.red }]}>
            {sym()} {totalFiltered.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </Text>
          {!showSearch && (
            <Text style={styles.hint}>
              ← {i18n.t('swipeHint')}
            </Text>
          )}
          {showSearch && search.length > 0 && (
            <Text style={styles.hint}>
              {i18n.t('found')}: {filtered.length}
            </Text>
          )}
        </View>
      )}

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TransactionItem
            transaction={item}
            onDelete={(t) => setDeleteTarget(t)}
            onEdit={handleEdit}
            onDuplicate={handleDuplicate}
          />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name={search ? 'search' : 'inbox'} size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              {search ? i18n.t('noResults') : i18n.t('noTransactions')}
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
        <Feather name="plus" size={26} color={colors.bg} />
      </TouchableOpacity>

      <AddTransactionModal
        visible={showAdd || !!editTx}
        onClose={handleCloseModal}
        onSave={() => loadData()}
        editTransaction={editTx}
      />

      <ConfirmModal
        visible={!!deleteTarget}
        title={i18n.t('delete')}
        message={deleteTarget ? `${i18n.t(deleteTarget.categoryId)} — ${sym()}${deleteTarget.amount}` : ''}
        confirmText={i18n.t('delete')} cancelText={i18n.t('cancel')}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)}
      />
    </GestureHandlerRootView>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 16 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  searchBtnActive: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  badge: { backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder },
  badgeText: { color: colors.textDim, fontSize: 15, fontWeight: '700' },

  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, marginBottom: 12, backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.cardBorder, gap: 10 },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 12 },

  filters: { flexDirection: 'row', paddingHorizontal: 24, gap: 8, marginBottom: 12 },
  filterBtn: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: 'transparent', alignItems: 'center' },
  filterActive: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  filterText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: colors.green },

  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 8 },
  summaryAmount: { fontSize: 16, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 11, opacity: 0.6 },

  list: { paddingHorizontal: 20, paddingBottom: 120 },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: colors.textMuted, fontSize: 15, fontWeight: '600', marginTop: 12 },

  fab: { position: 'absolute', right: 24, bottom: 100, width: 60, height: 60, borderRadius: 18, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center', elevation: 10, shadowColor: colors.green, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16 },
});