// src/screens/TransactionsScreen.js
import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import i18n from '../i18n';
import TransactionItem from '../components/TransactionItem';
import AddTransactionModal from '../components/AddTransactionModal';
import dataService from '../services/dataService';

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);

  const loadData = async () => {
    const txs = await dataService.getTransactions();
    setTransactions(txs);
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const filtered = filter === 'all' ? transactions
    : transactions.filter(t => t.type === filter);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{i18n.t('transactions')}</Text>
        <Text style={styles.count}>{filtered.length}</Text>
      </View>

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

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <TransactionItem transaction={item} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>{i18n.t('noTransactions')}</Text>}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setShowAdd(true)}>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  count: { color: colors.textMuted, fontSize: 16, fontWeight: '600', backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  filters: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 16 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: 'transparent' },
  filterActive: { borderColor: colors.green, backgroundColor: colors.greenGlow },
  filterText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: colors.green },
  list: { paddingHorizontal: 20 },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: 60, fontSize: 14 },
  fab: { position: 'absolute', right: 24, bottom: 100, width: 56, height: 56, borderRadius: 16, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center', elevation: 8 },
  fabText: { color: colors.bg, fontSize: 28, fontWeight: '700', marginTop: -2 },
});
