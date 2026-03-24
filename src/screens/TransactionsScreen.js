// src/screens/TransactionsScreen.js
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AddTransactionModal from '../components/AddTransactionModal';
import TransactionItem from '../components/TransactionItem';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { colors } from '../theme/colors';
 
export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [, forceUpdate] = useState(0);
 
  const loadData = async () => {
    const txs = await dataService.getTransactions();
    setTransactions(txs);
    forceUpdate(n => n + 1);
  };
 
  useFocusEffect(useCallback(() => { loadData(); }, []));
 
  const filtered = filter === 'all' ? transactions
    : transactions.filter(t => t.type === filter);
 
  const totalFiltered = filtered.reduce((sum, t) => {
    return sum + (t.type === 'income' ? t.amount : -t.amount);
  }, 0);
 
  const handleDelete = (tx) => {
    Alert.alert(
      i18n.t('delete'),
      `${i18n.t(tx.categoryId)} — ₪${tx.amount}?`,
      [
        { text: i18n.t('cancel'), style: 'cancel' },
        { text: i18n.t('delete'), style: 'destructive', onPress: async () => {
          await dataService.deleteTransaction(tx.id);
          await loadData();
        }},
      ]
    );
  };
 
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{i18n.t('transactions')}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{filtered.length}</Text>
        </View>
      </View>
 
      {/* Filters */}
      <View style={styles.filters}>
        {['all', 'expense', 'income'].map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? i18n.t('all') : f === 'income' ? i18n.t('incomeType') : i18n.t('expenseType')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
 
      {/* Summary */}
      {filtered.length > 0 && (
        <View style={styles.summary}>
          <Text style={[styles.summaryAmount, { color: totalFiltered >= 0 ? colors.green : colors.red }]}>
            ₪ {totalFiltered.toLocaleString()}
          </Text>
        </View>
      )}
 
      {/* Hint */}
      {filtered.length > 0 && (
        <Text style={styles.hint}>
          {i18n.getLanguage() === 'ru' ? 'Долгое нажатие для удаления' : 
           i18n.getLanguage() === 'he' ? 'לחיצה ארוכה למחיקה' : 'Long press to delete'}
        </Text>
      )}
 
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TransactionItem
            transaction={item}
            onPress={() => handleDelete(item)}
          />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>{i18n.t('noTransactions')}</Text>
          </View>
        }
      />
 
      <TouchableOpacity style={styles.fab} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
 
      <AddTransactionModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={() => loadData()}
      />
    </View>
  );
}
 
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 60, paddingBottom: 16,
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  badge: {
    backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder,
  },
  badgeText: { color: colors.textDim, fontSize: 15, fontWeight: '700' },
  filters: {
    flexDirection: 'row', paddingHorizontal: 24, gap: 8, marginBottom: 12,
  },
  filterBtn: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12,
    backgroundColor: colors.card, borderWidth: 1, borderColor: 'transparent',
  },
  filterActive: {
    borderColor: colors.green, backgroundColor: colors.greenSoft,
  },
  filterText: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  filterTextActive: { color: colors.green },
  summary: {
    paddingHorizontal: 24, marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 16, fontWeight: '700',
  },
  hint: {
    color: colors.textMuted, fontSize: 11, paddingHorizontal: 24,
    marginBottom: 8, opacity: 0.6,
  },
  list: { paddingHorizontal: 24, paddingBottom: 120 },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 36, marginBottom: 12 },
  emptyText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  fab: {
    position: 'absolute', right: 24, bottom: 100,
    width: 60, height: 60, borderRadius: 18, backgroundColor: colors.green,
    justifyContent: 'center', alignItems: 'center', elevation: 10,
    shadowColor: colors.green, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 16,
  },
  fabText: { color: colors.bg, fontSize: 30, fontWeight: '700', marginTop: -2 },
});