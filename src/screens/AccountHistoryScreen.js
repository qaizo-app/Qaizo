// src/screens/AccountHistoryScreen.js
// Баланс исправлен, + не показывает выбор счёта, свайп работает
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
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
  const [currentBalance, setCurrentBalance] = useState(account.balance || 0);
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
    <View>
      <TransactionItem transaction={item}
        onDelete={(t) => setDeleteTarget(t)}
        onEdit={(t) => setEditTx(t)}
        onDuplicate={handleDuplicate} />
      <View style={styles.balLine}>
        <Text style={[styles.runBal, { color: item.runningBalance >= 0 ? colors.textMuted : colors.red }]}>
          {lang==='ru'?'Остаток':lang==='he'?'יתרה':'Bal'}: {account.currency||'₪'} {item.runningBalance.toLocaleString()}
        </Text>
      </View>
    </View>
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name={i18n.isRTL() ? "arrow-right" : "arrow-left"} size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{account.name}</Text>
          <Text style={styles.headerType}>{account.accountNumber ? `${account.accountNumber} · ` : ''}{account.type}</Text>
        </View>
        <View style={[styles.headerIcon, { backgroundColor: `${cfg.color}18` }]}>
          <MaterialCommunityIcons name={cfg.icon} size={22} color={cfg.color} />
        </View>
      </View>

      <View style={styles.balCard}>
        <Text style={styles.balLabel}>{lang==='ru'?'Баланс':lang==='he'?'יתרה':'Balance'}</Text>
        <Text style={[styles.balAmount, { color: currentBalance >= 0 ? colors.text : colors.red }]}>
          {account.currency||'₪'} {currentBalance.toLocaleString()}
        </Text>
        {account.overdraft && <Text style={styles.odText}>{lang==='ru'?'Лимит':'Limit'}: {account.currency||'₪'}{account.overdraft.toLocaleString()}</Text>}
      </View>

      <View style={styles.countRow}>
        <Text style={styles.countText}>{lang==='ru'?'Транзакции':'Transactions'}</Text>
        <View style={styles.countBadge}><Text style={styles.countNum}>{transactions.length}</Text></View>
      </View>

      <FlatList data={withBalance} keyExtractor={item=>item.id} renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<View style={styles.empty}><Feather name="inbox" size={36} color={colors.textMuted} /><Text style={styles.emptyText}>{lang==='ru'?'Нет транзакций':'No transactions'}</Text></View>} />

      <TouchableOpacity style={styles.fab} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
        <Feather name="plus" size={26} color={colors.bg} />
      </TouchableOpacity>

      {/* preselectedAccount — модалка не покажет выбор счёта */}
      <AddTransactionModal visible={showAdd||!!editTx} onClose={handleCloseModal}
        onSave={() => loadData()} editTransaction={editTx} preselectedAccount={account.id} />

      <ConfirmModal visible={!!deleteTarget} title={i18n.t('delete')}
        message={deleteTarget ? `${i18n.t(deleteTarget.categoryId)} — ₪${deleteTarget.amount}` : ''}
        confirmText={i18n.t('delete')} cancelText={i18n.t('cancel')}
        onConfirm={handleDelete} onCancel={()=>setDeleteTarget(null)} />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:colors.bg},
  header:{flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingTop:56,paddingBottom:16},
  backBtn:{width:44,height:44,borderRadius:14,backgroundColor:colors.card,justifyContent:'center',alignItems:'center',marginEnd:14,borderWidth:1,borderColor:colors.cardBorder},
  headerInfo:{flex:1},
  headerName:{color:colors.text,fontSize:20,fontWeight:'700'},
  headerType:{color:colors.textMuted,fontSize:13,marginTop:2},
  headerIcon:{width:48,height:48,borderRadius:14,justifyContent:'center',alignItems:'center'},
  balCard:{marginHorizontal:20,marginBottom:16,backgroundColor:colors.card,borderRadius:20,padding:20,borderWidth:1,borderColor:'rgba(52,211,153,0.15)'},
  balLabel:{color:colors.textDim,fontSize:13,marginBottom:6},
  balAmount:{fontSize:32,fontWeight:'800',letterSpacing:-1},
  odText:{color:colors.textMuted,fontSize:12,marginTop:8},
  countRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:20,marginBottom:8},
  countText:{color:colors.text,fontSize:16,fontWeight:'700'},
  countBadge:{backgroundColor:colors.card,paddingHorizontal:12,paddingVertical:4,borderRadius:10,borderWidth:1,borderColor:colors.cardBorder},
  countNum:{color:colors.textDim,fontSize:14,fontWeight:'700'},
  list:{paddingHorizontal:20,paddingBottom:120},
  balLine:{paddingStart:58,paddingBottom:6,borderBottomWidth:1,borderBottomColor:colors.divider},
  runBal:{fontSize:11,fontWeight:'500'},
  empty:{alignItems:'center',paddingVertical:50},
  emptyText:{color:colors.textMuted,fontSize:15,marginTop:12},
  fab:{position:'absolute',right:24,bottom:30,width:60,height:60,borderRadius:18,backgroundColor:colors.green,justifyContent:'center',alignItems:'center',elevation:10,shadowColor:colors.green,shadowOffset:{width:0,height:6},shadowOpacity:0.4,shadowRadius:16},
});