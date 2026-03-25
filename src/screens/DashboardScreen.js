// src/screens/DashboardScreen.js
// Редактирование транзакций работает со свайпа
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AddTransactionModal from '../components/AddTransactionModal';
import Card from '../components/Card';
import ConfirmModal from '../components/ConfirmModal';
import TransactionItem from '../components/TransactionItem';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { categoryConfig, colors } from '../theme/colors';

export default function DashboardScreen() {
  const [transactions, setTransactions] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editTx, setEditTx] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [, forceUpdate] = useState(0);

  const loadData = async () => {
    const txs = await dataService.getTransactions();
    setTransactions(txs);
    forceUpdate(n => n + 1);
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));
  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const thisMonth = transactions.filter(t => {
    const d = new Date(t.date || t.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const totalIncome = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;
  const recentTx = transactions.slice(0, 8);

  const categoryTotals = {};
  thisMonth.filter(t => t.type === 'expense').forEach(t => {
    const cat = t.categoryId || 'other';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + t.amount;
  });
  const topCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 4);

  const now = new Date();
  const monthNames = {
    ru: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
    he: ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'],
    en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  };
  const lang = i18n.getLanguage();
  const dateStr = `${(monthNames[lang]||monthNames.en)[now.getMonth()]} ${now.getFullYear()}`;

  const handleDelete = async () => {
    if (deleteTarget) { await dataService.deleteTransaction(deleteTarget.id); setDeleteTarget(null); await loadData(); }
  };
  const handleDuplicate = async (tx) => {
    await dataService.addTransaction({ ...tx, id: undefined, createdAt: undefined, date: new Date().toISOString(), note: tx.note ? `${tx.note} (copy)` : '(copy)' });
    await loadData();
  };
  const handleCloseModal = () => { setShowAdd(false); setEditTx(null); };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
        contentContainerStyle={{ paddingBottom: 120 }}>

        <View style={styles.header}>
          <View>
            <Text style={styles.logo}><Text style={styles.logoQ}>Q</Text>aizo</Text>
            <Text style={styles.subtitle}>{dateStr}</Text>
          </View>
          <TouchableOpacity style={styles.profileBtn}>
            <Feather name="user" size={20} color={colors.textDim} />
          </TouchableOpacity>
        </View>

        <Card highlighted>
          <Text style={styles.balanceLabel}>{i18n.t('totalBalance')}</Text>
          <Text style={[styles.balanceAmount, { color: balance >= 0 ? colors.text : colors.red }]}>₪ {balance.toLocaleString()}</Text>
          <View style={styles.incExpRow}>
            <View style={styles.incExpItem}>
              <View style={styles.incExpHeader}>
                <Feather name="trending-up" size={14} color={colors.green} />
                <Text style={styles.incLabel}> {i18n.t('income')}</Text>
              </View>
              <Text style={styles.incAmount}>₪ {totalIncome.toLocaleString()}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.incExpItem}>
              <View style={styles.incExpHeader}>
                <Feather name="trending-down" size={14} color={colors.red} />
                <Text style={styles.expLabel}> {i18n.t('expenses')}</Text>
              </View>
              <Text style={styles.expAmount}>₪ {totalExpense.toLocaleString()}</Text>
            </View>
          </View>
        </Card>

        {topCategories.length > 0 && (
          <View style={styles.quickStats}>
            {topCategories.map(([cat, amount]) => {
              const cfg = categoryConfig[cat] || categoryConfig.other;
              return (
                <View key={cat} style={styles.quickStatItem}>
                  <View style={[styles.quickStatIcon, { backgroundColor: `${cfg.color}18` }]}>
                    <Feather name={cfg.icon} size={14} color={cfg.color} />
                  </View>
                  <Text style={styles.quickStatLabel} numberOfLines={1}>{i18n.t(cat)}</Text>
                  <Text style={styles.quickStatAmount}>₪{amount}</Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{i18n.t('recentTransactions')}</Text>
          <TouchableOpacity><Text style={styles.seeAll}>{i18n.t('seeAll')}</Text></TouchableOpacity>
        </View>

        <Card>
          {recentTx.length > 0 ? recentTx.map(tx => (
            <TransactionItem key={tx.id} transaction={tx}
              onDelete={(t) => setDeleteTarget(t)}
              onEdit={(t) => setEditTx(t)}
              onDuplicate={handleDuplicate}
            />
          )) : (
            <View style={styles.emptyContainer}>
              <Feather name="inbox" size={36} color={colors.textMuted} />
              <Text style={styles.emptyText}>{i18n.t('noTransactions')}</Text>
            </View>
          )}
        </Card>
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
        <Feather name="plus" size={26} color={colors.bg} />
      </TouchableOpacity>

      <AddTransactionModal visible={showAdd || !!editTx} onClose={handleCloseModal} onSave={() => loadData()} editTransaction={editTx} />

      <ConfirmModal visible={!!deleteTarget} title={i18n.t('delete')}
        message={deleteTarget ? `${i18n.t(deleteTarget.categoryId)} — ₪${deleteTarget.amount}` : ''}
        confirmText={i18n.t('delete')} cancelText={i18n.t('cancel')}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:24, paddingTop:60, paddingBottom:24 },
  logo: { color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -1 },
  logoQ: { color: colors.green },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  profileBtn: { width:44, height:44, borderRadius:14, backgroundColor:colors.card, borderWidth:1, borderColor:colors.cardBorder, justifyContent:'center', alignItems:'center' },

  balanceLabel: { color:colors.textDim, fontSize:13, marginBottom:8 },
  balanceAmount: { fontSize:40, fontWeight:'800', letterSpacing:-1.5, marginBottom:24 },
  incExpRow: { flexDirection:'row', alignItems:'center', backgroundColor:colors.cardHighlight, borderRadius:14, padding:16 },
  incExpItem: { flex:1 },
  incExpHeader: { flexDirection:'row', alignItems:'center', marginBottom:6 },
  divider: { width:1, height:40, backgroundColor:colors.divider, marginHorizontal:16 },
  incLabel: { color:colors.green, fontSize:12, fontWeight:'600' },
  incAmount: { color:colors.green, fontSize:20, fontWeight:'700', paddingLeft:4 },
  expLabel: { color:colors.red, fontSize:12, fontWeight:'600' },
  expAmount: { color:colors.red, fontSize:20, fontWeight:'700', paddingLeft:4 },

  quickStats: { flexDirection:'row', paddingHorizontal:24, gap:8, marginTop:4, marginBottom:8 },
  quickStatItem: { flex:1, backgroundColor:colors.card, borderRadius:14, padding:10, borderWidth:1, borderColor:colors.cardBorder, alignItems:'center' },
  quickStatIcon: { width:28, height:28, borderRadius:8, justifyContent:'center', alignItems:'center', marginBottom:6 },
  quickStatLabel: { color:colors.textDim, fontSize:10, fontWeight:'600', marginBottom:2 },
  quickStatAmount: { color:colors.textSecondary, fontSize:13, fontWeight:'700' },

  sectionHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:24, marginTop:28, marginBottom:12 },
  sectionTitle: { color:colors.text, fontSize:18, fontWeight:'700' },
  seeAll: { color:colors.green, fontSize:13, fontWeight:'600' },

  emptyContainer: { alignItems:'center', paddingVertical:36 },
  emptyText: { color:colors.textMuted, fontSize:15, fontWeight:'600', marginTop:12 },

  fab: { position:'absolute', right:24, bottom:100, width:60, height:60, borderRadius:18, backgroundColor:colors.green, justifyContent:'center', alignItems:'center', shadowColor:colors.green, shadowOffset:{width:0,height:6}, shadowOpacity:0.4, shadowRadius:16, elevation:10 },
});