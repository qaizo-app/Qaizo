// src/screens/AccountHistoryScreen.js
// Кнопка +, свайп действия, тёмный модал удаления
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AddTransactionModal from '../components/AddTransactionModal';
import ConfirmModal from '../components/ConfirmModal';
import TransactionItem from '../components/TransactionItem';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { accountTypeConfig, colors } from '../theme/colors';

export default function AccountHistoryScreen({ route, navigation }) {
  const { account } = route.params;
  const [transactions, setTransactions] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editTx, setEditTx] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const lang = i18n.getLanguage();
  const cfg = accountTypeConfig[account.type] || accountTypeConfig.bank;

  const loadData = async () => {
    const all = await dataService.getTransactions();
    const filtered = all
      .filter(t => t.account === account.id)
      .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
    setTransactions(filtered);
  };

  useEffect(() => { loadData(); }, [account.id]);

  const handleDelete = async () => {
    if (deleteTarget) { await dataService.deleteTransaction(deleteTarget.id); setDeleteTarget(null); await loadData(); }
  };
  const handleDuplicate = async (tx) => {
    await dataService.addTransaction({ ...tx, id: undefined, createdAt: undefined, date: new Date().toISOString(), note: tx.note ? `${tx.note} (copy)` : '(copy)' });
    await loadData();
  };
  const handleCloseModal = () => { setShowAdd(false); setEditTx(null); };

  // Running balance calculation
  const withBalance = (() => {
    const sorted = [...transactions].reverse();
    let running = account.balance || 0;
    sorted.forEach(tx => { if (tx.type === 'income') running -= tx.amount; else running += tx.amount; });
    const result = [];
    sorted.forEach(tx => {
      if (tx.type === 'income') running += tx.amount; else running -= tx.amount;
      result.push({ ...tx, runningBalance: running });
    });
    return result.reverse();
  })();

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  };

  const renderItem = ({ item }) => (
    <View>
      <TransactionItem
        transaction={item}
        onDelete={(t) => setDeleteTarget(t)}
        onEdit={(t) => setEditTx(t)}
        onDuplicate={handleDuplicate}
      />
      <View style={styles.balanceRow}>
        <Text style={[styles.runningBalance, { color: item.runningBalance >= 0 ? colors.textMuted : colors.red }]}>
          {lang === 'ru' ? 'Остаток' : lang === 'he' ? 'יתרה' : 'Balance'}: {account.currency || '₪'} {item.runningBalance.toLocaleString()}
        </Text>
      </View>
    </View>
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{account.name}</Text>
          <Text style={styles.headerType}>
            {account.accountNumber ? `${account.accountNumber} · ` : ''}
            {account.type}
          </Text>
        </View>
        <View style={[styles.headerIcon, { backgroundColor: `${cfg.color}18` }]}>
          <MaterialCommunityIcons name={cfg.icon} size={22} color={cfg.color} />
        </View>
      </View>

      {/* Balance */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>{lang === 'ru' ? 'Текущий баланс' : lang === 'he' ? 'יתרה נוכחית' : 'Current Balance'}</Text>
        <Text style={[styles.balanceAmount, { color: (account.balance || 0) >= 0 ? colors.text : colors.red }]}>
          {account.currency || '₪'} {(account.balance || 0).toLocaleString()}
        </Text>
        {account.overdraft && (
          <Text style={styles.overdraftText}>{lang === 'ru' ? 'Лимит' : 'Limit'}: {account.currency || '₪'}{account.overdraft.toLocaleString()}</Text>
        )}
      </View>

      {/* Count + hint */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>{lang === 'ru' ? 'Транзакции' : 'Transactions'}</Text>
        <View style={styles.countBadge}><Text style={styles.countNumber}>{transactions.length}</Text></View>
      </View>
      {transactions.length > 0 && (
        <Text style={styles.hint}>← {lang === 'ru' ? 'свайпни для действий' : 'swipe for actions'}</Text>
      )}

      {/* List */}
      <FlatList
        data={withBalance}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="inbox" size={36} color={colors.textMuted} />
            <Text style={styles.emptyText}>{lang === 'ru' ? 'Нет транзакций' : 'No transactions'}</Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
        <Feather name="plus" size={26} color={colors.bg} />
      </TouchableOpacity>

      <AddTransactionModal visible={showAdd || !!editTx} onClose={handleCloseModal} onSave={() => loadData()} editTransaction={editTx} />

      <ConfirmModal visible={!!deleteTarget} title={i18n.t('delete')}
        message={deleteTarget ? `${i18n.t(deleteTarget.categoryId)} — ₪${deleteTarget.amount}` : ''}
        confirmText={i18n.t('delete')} cancelText={i18n.t('cancel')}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', marginRight: 14, borderWidth: 1, borderColor: colors.cardBorder },
  headerInfo: { flex: 1 },
  headerName: { color: colors.text, fontSize: 20, fontWeight: '700' },
  headerType: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  headerIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },

  balanceCard: { marginHorizontal: 20, marginBottom: 16, backgroundColor: colors.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(52,211,153,0.15)' },
  balanceLabel: { color: colors.textDim, fontSize: 13, marginBottom: 6 },
  balanceAmount: { fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  overdraftText: { color: colors.textMuted, fontSize: 12, marginTop: 8 },

  countRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 4 },
  countText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  countBadge: { backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: colors.cardBorder },
  countNumber: { color: colors.textDim, fontSize: 14, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 11, paddingHorizontal: 20, marginBottom: 8, opacity: 0.5 },

  list: { paddingHorizontal: 20, paddingBottom: 120 },

  balanceRow: { paddingLeft: 58, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  runningBalance: { fontSize: 11, fontWeight: '500' },

  emptyContainer: { alignItems: 'center', paddingVertical: 50 },
  emptyText: { color: colors.textMuted, fontSize: 15, marginTop: 12 },

  fab: { position: 'absolute', right: 24, bottom: 30, width: 60, height: 60, borderRadius: 18, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center', shadowColor: colors.green, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10 },
});