// src/screens/AccountHistoryScreen.js
// История транзакций по счёту с итоговым остатком после каждой
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CategoryIcon from '../components/CategoryIcon';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { accountTypeConfig, colors } from '../theme/colors';

export default function AccountHistoryScreen({ route, navigation }) {
  const { account } = route.params;
  const [transactions, setTransactions] = useState([]);
  const lang = i18n.getLanguage();
  const cfg = accountTypeConfig[account.type] || accountTypeConfig.bank;

  useEffect(() => {
    const load = async () => {
      const all = await dataService.getTransactions();
      const filtered = all
        .filter(t => t.account === account.id)
        .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
      setTransactions(filtered);
    };
    load();
  }, [account.id]);

  // Calculate running balance (from oldest to newest, then reverse for display)
  const withBalance = (() => {
    const sorted = [...transactions].reverse();
    let running = account.balance || 0;
    // Start from current balance, subtract forward transactions to get starting point
    sorted.forEach(tx => {
      if (tx.type === 'income') running -= tx.amount;
      else running += tx.amount;
    });
    // Now go forward and add running balance
    const result = [];
    sorted.forEach(tx => {
      if (tx.type === 'income') running += tx.amount;
      else running -= tx.amount;
      result.push({ ...tx, runningBalance: running });
    });
    return result.reverse();
  })();

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  };

  const renderItem = ({ item }) => {
    const isIncome = item.type === 'income';
    const sign = isIncome ? '+' : '-';
    const amountColor = isIncome ? colors.green : colors.red;

    return (
      <View style={styles.txRow}>
        <CategoryIcon categoryId={item.categoryId} size="small" />
        <View style={styles.txInfo}>
          <Text style={styles.txCategory}>{i18n.t(item.categoryId) || item.categoryId}</Text>
          <Text style={styles.txMeta}>
            {item.recipient ? `${item.recipient} · ` : ''}{formatDate(item.date || item.createdAt)}
          </Text>
        </View>
        <View style={styles.txAmounts}>
          <Text style={[styles.txAmount, { color: amountColor }]}>
            {sign}{Math.abs(item.amount).toLocaleString()} {account.currency || '₪'}
          </Text>
          <Text style={[styles.txBalance, {
            color: item.runningBalance >= 0 ? colors.textDim : colors.red
          }]}>
            {item.runningBalance >= 0 ? '' : ''}{item.runningBalance.toLocaleString()} {account.currency || '₪'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{account.name}</Text>
          <Text style={styles.headerType}>
            {account.accountNumber ? `${account.accountNumber} · ` : ''}
            {lang === 'ru' && account.type === 'bank' ? 'Банк' :
             lang === 'ru' && account.type === 'credit' ? 'Кредитка' :
             lang === 'ru' && account.type === 'cash' ? 'Наличные' : account.type}
          </Text>
        </View>
        <View style={[styles.headerIcon, { backgroundColor: `${cfg.color}18` }]}>
          <MaterialCommunityIcons name={cfg.icon} size={22} color={cfg.color} />
        </View>
      </View>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>
          {lang === 'ru' ? 'Текущий баланс' : lang === 'he' ? 'יתרה נוכחית' : 'Current Balance'}
        </Text>
        <Text style={[styles.balanceAmount, { color: (account.balance || 0) >= 0 ? colors.text : colors.red }]}>
          {account.currency || '₪'} {(account.balance || 0).toLocaleString()}
        </Text>
        {account.overdraft && (
          <Text style={styles.overdraftText}>
            {lang === 'ru' ? 'Лимит' : 'Limit'}: {account.currency || '₪'}{account.overdraft.toLocaleString()}
          </Text>
        )}
      </View>

      {/* Transaction count */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>
          {lang === 'ru' ? 'Транзакции' : lang === 'he' ? 'תנועות' : 'Transactions'}
        </Text>
        <View style={styles.countBadge}>
          <Text style={styles.countNumber}>{transactions.length}</Text>
        </View>
      </View>

      {/* Transactions with running balance */}
      <FlatList
        data={withBalance}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="inbox" size={36} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              {lang === 'ru' ? 'Нет транзакций' : lang === 'he' ? 'אין תנועות' : 'No transactions'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: colors.card,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
    borderWidth: 1, borderColor: colors.cardBorder,
  },
  headerInfo: { flex: 1 },
  headerName: { color: colors.text, fontSize: 20, fontWeight: '700' },
  headerType: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  headerIcon: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },

  balanceCard: {
    marginHorizontal: 20, marginBottom: 16, backgroundColor: colors.card,
    borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(52,211,153,0.15)',
  },
  balanceLabel: { color: colors.textDim, fontSize: 13, marginBottom: 6 },
  balanceAmount: { fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  overdraftText: { color: colors.textMuted, fontSize: 12, marginTop: 8 },

  countRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 12,
  },
  countText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  countBadge: {
    backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 10, borderWidth: 1, borderColor: colors.cardBorder,
  },
  countNumber: { color: colors.textDim, fontSize: 14, fontWeight: '700' },

  list: { paddingHorizontal: 20, paddingBottom: 40 },

  txRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  txInfo: { flex: 1, marginLeft: 12 },
  txCategory: { color: colors.text, fontSize: 14, fontWeight: '600' },
  txMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  txAmounts: { alignItems: 'flex-end' },
  txAmount: { fontSize: 15, fontWeight: '700' },
  txBalance: { fontSize: 11, fontWeight: '500', marginTop: 3 },

  emptyContainer: { alignItems: 'center', paddingVertical: 50 },
  emptyText: { color: colors.textMuted, fontSize: 15, marginTop: 12 },
});