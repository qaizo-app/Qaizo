// src/screens/TransactionsScreen.js
// Свайп: удалить, изменить (работает!), дублировать
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AddTransactionModal from '../components/AddTransactionModal';
import ConfirmModal from '../components/ConfirmModal';
import TransactionItem from '../components/TransactionItem';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { colors } from '../theme/colors';

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editTx, setEditTx] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [, forceUpdate] = useState(0);

  const loadData = async () => {
    const txs = await dataService.getTransactions();
    setTransactions(txs);
    forceUpdate(n => n + 1);
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const filtered = filter === 'all' ? transactions : transactions.filter(t => t.type === filter);
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

  const handleEdit = (tx) => {
    setEditTx(tx);
  };

  const handleCloseModal = () => {
    setShowAdd(false);
    setEditTx(null);
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{i18n.t('transactions')}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{filtered.length}</Text>
        </View>
      </View>

      <View style={styles.filters}>
        {['all', 'expense', 'income'].map(f => {
          const active = filter === f;
          const label = f === 'all' ? i18n.t('all') : f === 'income' ? i18n.t('incomeType') : i18n.t('expenseType');
          const ic = f === 'all' ? 'list' : f === 'income' ? 'trending-up' : 'trending-down';
          return (
            <TouchableOpacity key={f} style={[styles.filterBtn, active && styles.filterActive]} onPress={() => setFilter(f)}>
              <Feather name={ic} size={14} color={active ? colors.green : colors.textMuted} style={{ marginRight: 4 }} />
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {filtered.length > 0 && (
        <View style={styles.summary}>
          <Text style={[styles.summaryAmount, { color: totalFiltered >= 0 ? colors.green : colors.red }]}>
            ₪ {totalFiltered.toLocaleString()}
          </Text>
          <Text style={styles.hint}>
            ← {i18n.getLanguage() === 'ru' ? 'свайпни для действий' : i18n.getLanguage() === 'he' ? 'החלק לפעולות' : 'swipe for actions'}
          </Text>
        </View>
      )}

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
            <Feather name="inbox" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>{i18n.t('noTransactions')}</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
        <Feather name="plus" size={26} color={colors.bg} />
      </TouchableOpacity>

      {/* Add / Edit modal */}
      <AddTransactionModal
        visible={showAdd || !!editTx}
        onClose={handleCloseModal}
        onSave={() => loadData()}
        editTransaction={editTx}
      />

      <ConfirmModal
        visible={!!deleteTarget}
        title={i18n.t('delete')}
        message={deleteTarget ? `${i18n.t(deleteTarget.categoryId)} — ₪${deleteTarget.amount}` : ''}
        confirmText={i18n.t('delete')} cancelText={i18n.t('cancel')}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:24, paddingTop:60, paddingBottom:16 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  badge: { backgroundColor:colors.card, paddingHorizontal:14, paddingVertical:6, borderRadius:12, borderWidth:1, borderColor:colors.cardBorder },
  badgeText: { color: colors.textDim, fontSize: 15, fontWeight: '700' },

  filters: { flexDirection:'row', paddingHorizontal:24, gap:8, marginBottom:12 },
  filterBtn: { flexDirection:'row', paddingHorizontal:16, paddingVertical:10, borderRadius:12, backgroundColor:colors.card, borderWidth:1, borderColor:'transparent', alignItems:'center' },
  filterActive: { borderColor:colors.green, backgroundColor:colors.greenSoft },
  filterText: { color:colors.textDim, fontSize:13, fontWeight:'600' },
  filterTextActive: { color:colors.green },

  summary: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:24, marginBottom:8 },
  summaryAmount: { fontSize:16, fontWeight:'700' },
  hint: { color:colors.textMuted, fontSize:11, opacity:0.6 },

  list: { paddingHorizontal:20, paddingBottom:120 },
  emptyContainer: { alignItems:'center', paddingVertical:60 },
  emptyText: { color:colors.textMuted, fontSize:15, fontWeight:'600', marginTop:12 },

  fab: { position:'absolute', right:24, bottom:100, width:60, height:60, borderRadius:18, backgroundColor:colors.green, justifyContent:'center', alignItems:'center', elevation:10, shadowColor:colors.green, shadowOffset:{width:0,height:6}, shadowOpacity:0.4, shadowRadius:16 },
});