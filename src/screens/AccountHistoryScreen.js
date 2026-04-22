// src/screens/AccountHistoryScreen.js
// Баланс исправлен, + не показывает выбор счёта, свайп работает
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AddTransactionModal from '../components/AddTransactionModal';
import BalanceLineChart from '../components/BalanceLineChart';
import ConfirmModal from '../components/ConfirmModal';
import TransactionItem from '../components/TransactionItem';
import { getCachedGroups } from '../components/CategoryIcon';
import { getCatName } from '../components/CategoryPickerModal';
import i18n from '../i18n';
import analyticsService from '../services/analyticsService';
import dataService from '../services/dataService';
import { accountTypeConfig, colors } from '../theme/colors';
import Amount from '../components/Amount';
import { sym } from '../utils/currency';

const PERIODS = [
  { key: '1m', days: 30, labelKey: 'period30d' },
  { key: '3m', days: 90, labelKey: 'period3m' },
  { key: '6m', days: 180, labelKey: 'period6m' },
  { key: '1y', days: 365, labelKey: 'period1y' },
];

export default function AccountHistoryScreen({ route, navigation }) {
  const { account } = route.params;
  const [transactions, setTransactions] = useState([]);
  const [currentBalance, setCurrentBalance] = useState(account.balance || 0);
  const [showAdd, setShowAdd] = useState(false);
  const [editTx, setEditTx] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [periodKey, setPeriodKey] = useState('3m');
  const lang = i18n.getLanguage();

  const styles = createStyles();

  const cfg = accountTypeConfig[account.type] || accountTypeConfig.bank;

  const loadData = async () => {
    const all = await dataService.getTransactions();

    // Build transferPairId → pair map using ALL transactions, so we can display
    // both "from → to" sides on the account screen regardless of which side the
    // current account plays in the pair.
    const pairMap = {};
    for (const tx of all) {
      if (tx.isTransfer && tx.transferPairId) {
        if (!pairMap[tx.transferPairId]) pairMap[tx.transferPairId] = {};
        pairMap[tx.transferPairId][tx.type] = tx;
      }
    }

    const filtered = all
      .filter(t => t.account === account.id)
      .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
      .map(tx => {
        if (!tx.isTransfer || !tx.transferPairId) return tx;
        const pair = pairMap[tx.transferPairId];
        if (!pair?.expense || !pair?.income) return tx;
        const fromName = pair.income.recipient;
        const toName = pair.expense.recipient;
        if (!fromName || !toName) return tx;
        return { ...tx, note: `${fromName} → ${toName}` };
      });
    setTransactions(filtered);

    // Пересчитать баланс из транзакций
    const accs = await dataService.getAccounts();
    const acc = accs.find(a => a.id === account.id);
    if (acc) setCurrentBalance(acc.balance || 0);
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const handleDelete = async () => {
    if (deleteTarget) { await dataService.deleteTransaction(deleteTarget.id); setDeleteTarget(null); await loadData(); }
  };
  const handleDuplicate = async (tx) => {
    await dataService.addTransaction({ ...tx, id: undefined, createdAt: undefined, date: new Date().toISOString(), note: tx.note ? `${tx.note} (copy)` : '(copy)' });
    await loadData();
  };
  const handleCloseModal = () => { setShowAdd(false); setEditTx(null); };

  const periodDays = (PERIODS.find(p => p.key === periodKey) || PERIODS[1]).days;
  const chartData = analyticsService.getAccountBalanceHistory(transactions, account.id, currentBalance, periodDays);

  // Расчёт остатка после каждой транзакции
  const withBalance = (() => {
    if (transactions.length === 0) return [];
    let bal = currentBalance;
    const result = transactions.map(tx => {
      const entry = { ...tx, runningBalance: bal };
      if (tx.type === 'income') bal -= tx.amount;
      else bal += tx.amount;
      return entry;
    });
    return result;
  })();

  const renderItem = ({ item }) => (
    <TransactionItem transaction={item}
      runningBalance={item.runningBalance}
      currency={account.currency}
      onDelete={(t) => setDeleteTarget(t)}
      onEdit={(t) => setEditTx(t)}
      onDuplicate={handleDuplicate} />
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name={i18n.backIcon()} size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{account.name}</Text>
          <Text style={styles.headerType}>{account.accountNumber ? `${account.accountNumber} · ` : ''}{i18n.t(account.type)}</Text>
        </View>
        <View style={[styles.headerIcon, { backgroundColor: `${cfg.color}18` }]}>
          <MaterialCommunityIcons name={cfg.icon} size={22} color={cfg.color} />
        </View>
      </View>

      {chartData.length >= 2 ? (
        <View style={styles.chartCard}>
          <View style={styles.periodRow}>
            {PERIODS.map(p => {
              const active = p.key === periodKey;
              return (
                <TouchableOpacity key={p.key}
                  style={[styles.periodBtn, active && styles.periodBtnActive]}
                  onPress={() => setPeriodKey(p.key)}>
                  <Text style={[styles.periodTxt, active && styles.periodTxtActive]}>{i18n.t(p.labelKey)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <BalanceLineChart data={chartData}
            limit={account.overdraft}
            currency={account.currency}
            limitLabel={account.type === 'credit' ? i18n.t('creditLimit') : i18n.t('overdraft')} />
        </View>
      ) : (
        // Not enough data for a chart — still show current balance + limit
        <View style={styles.balCard}>
          <Text style={styles.balLabel}>{i18n.t('balance')}</Text>
          <Amount value={currentBalance} sign style={[styles.balAmount, { color: currentBalance >= 0 ? colors.text : colors.red }]} currency={account.currency} />
          {account.overdraft > 0 && (
            <Text style={styles.odText}>
              {account.type === 'credit' ? i18n.t('creditLimit') : i18n.t('overdraft')}:{' '}
              <Amount value={account.overdraft} style={styles.odText} currency={account.currency} />
            </Text>
          )}
        </View>
      )}

      <View style={styles.countRow}>
        <Text style={styles.countText}>{i18n.t('transactions')}</Text>
        <View style={styles.countBadge}><Text style={styles.countNum}>{transactions.length}</Text></View>
      </View>

      <FlatList data={withBalance} keyExtractor={item=>item.id} renderItem={renderItem}
        initialNumToRender={15} maxToRenderPerBatch={10} updateCellsBatchingPeriod={100}
        windowSize={5} removeClippedSubviews={true}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<View style={styles.empty}><Feather name="inbox" size={48} color={colors.textMuted} /><Text style={styles.emptyText}>{i18n.t('noTransactions')}</Text></View>} />

      <AddTransactionModal visible={showAdd||!!editTx} onClose={handleCloseModal}
        onSave={() => loadData()} editTransaction={editTx} preselectedAccount={account.id} />

      <ConfirmModal visible={!!deleteTarget} title={i18n.t('delete')}
        message={deleteTarget ? `${deleteTarget.categoryName || getCatName(deleteTarget.categoryId, getCachedGroups(), i18n.getLanguage())} — ${deleteTarget.amount} ${sym()}` : ''}
        confirmText={i18n.t('delete')} cancelText={i18n.t('cancel')}
        onConfirm={handleDelete} onCancel={()=>setDeleteTarget(null)} />
    </GestureHandlerRootView>
  );
}

const createStyles = () => StyleSheet.create({
  container:{flex:1,backgroundColor:colors.bg},
  header:{flexDirection:'row',alignItems:'center',paddingHorizontal:24,paddingTop:60,paddingBottom:16},
  backBtn:{width:44,height:44,borderRadius:14,backgroundColor:colors.card,justifyContent:'center',alignItems:'center',marginEnd:14,borderWidth:1,borderColor:colors.cardBorder},
  headerInfo:{flex:1},
  headerName:{color:colors.text,fontSize:20,fontWeight:'700'},
  headerType:{color:colors.textMuted,fontSize:12,marginTop:2},
  headerIcon:{width:48,height:48,borderRadius:14,justifyContent:'center',alignItems:'center'},
  balCard:{marginHorizontal:20,marginBottom:16,backgroundColor:colors.card,borderRadius:20,padding:20,borderWidth:1,borderColor:'rgba(52,211,153,0.15)'},
  balLabel:{color:colors.textDim,fontSize:12,marginBottom:6},
  balAmount:{fontSize:32,fontWeight:'800',letterSpacing:-1},
  odText:{color:colors.textMuted,fontSize:12,marginTop:8},
  chartCard:{marginHorizontal:20,marginBottom:16,backgroundColor:colors.card,borderRadius:20,padding:16,borderWidth:1,borderColor:colors.cardBorder},
  periodRow:{flexDirection:'row',gap:6,marginBottom:10},
  periodBtn:{paddingHorizontal:10,paddingVertical:6,borderRadius:8,backgroundColor:colors.bg2,borderWidth:1,borderColor:colors.cardBorder},
  periodBtnActive:{borderColor:colors.green,backgroundColor:colors.greenSoft},
  periodTxt:{color:colors.textDim,fontSize:11,fontWeight:'700'},
  periodTxtActive:{color:colors.green},
  countRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:20,marginBottom:8},
  countText:{color:colors.text,fontSize:16,fontWeight:'700'},
  countBadge:{backgroundColor:colors.card,paddingHorizontal:12,paddingVertical:4,borderRadius:10,borderWidth:1,borderColor:colors.cardBorder},
  countNum:{color:colors.textDim,fontSize:14,fontWeight:'700'},
  list:{paddingHorizontal:20,paddingBottom:120},
  balLine:{paddingStart:58,paddingBottom:6,borderBottomWidth:1,borderBottomColor:colors.divider},
  runBal:{fontSize:12,fontWeight:'500'},
  empty:{alignItems:'center',paddingVertical:50},
  emptyText:{color:colors.textMuted,fontSize:14,marginTop:12},
  fab:{position:'absolute',right:24,bottom:30,width:60,height:60,borderRadius:18,backgroundColor:colors.green,justifyContent:'center',alignItems:'center',elevation:10,shadowColor:colors.green,shadowOffset:{width:0,height:6},shadowOpacity:0.4,shadowRadius:16},
});