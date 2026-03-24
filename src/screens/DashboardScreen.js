// src/screens/DashboardScreen.js
// ЗАМЕНИ полностью — убрана кнопка языка, добавлена дата
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AddTransactionModal from '../components/AddTransactionModal';
import Card from '../components/Card';
import TransactionItem from '../components/TransactionItem';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { colors } from '../theme/colors';
 
export default function DashboardScreen() {
  const [transactions, setTransactions] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [, forceUpdate] = useState(0);
 
  const loadData = async () => {
    const txs = await dataService.getTransactions();
    setTransactions(txs);
    forceUpdate(n => n + 1);
  };
 
  useFocusEffect(useCallback(() => { loadData(); }, []));
 
  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };
 
  const thisMonth = transactions.filter(t => {
    const d = new Date(t.date || t.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
 
  const totalIncome = thisMonth.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = thisMonth.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const balance = totalIncome - totalExpense;
  const recentTx = transactions.slice(0, 8);
 
  // Top expense categories
  const categoryTotals = {};
  thisMonth.filter(t => t.type === 'expense').forEach(t => {
    const cat = t.categoryId || 'other';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + t.amount;
  });
  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
 
  // Date string
  const now = new Date();
  const monthNames = {
    ru: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
    he: ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'],
    en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  };
  const lang = i18n.getLanguage();
  const monthName = (monthNames[lang] || monthNames.en)[now.getMonth()];
  const dateStr = `${monthName} ${now.getFullYear()}`;
 
  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>
              <Text style={styles.logoQ}>Q</Text>aizo
            </Text>
            <Text style={styles.subtitle}>{dateStr}</Text>
          </View>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>👤</Text>
          </View>
        </View>
 
        {/* Balance Card */}
        <Card highlighted>
          <Text style={styles.balanceLabel}>{i18n.t('totalBalance')}</Text>
          <Text style={[styles.balanceAmount, balance >= 0 ? styles.balancePositive : styles.balanceNegative]}>
            ₪ {balance.toLocaleString()}
          </Text>
 
          <View style={styles.incExpRow}>
            <View style={styles.incExpItem}>
              <View style={styles.incExpHeader}>
                <View style={[styles.dot, { backgroundColor: colors.green }]} />
                <Text style={styles.incLabel}>{i18n.t('income')}</Text>
              </View>
              <Text style={styles.incAmount}>₪ {totalIncome.toLocaleString()}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.incExpItem}>
              <View style={styles.incExpHeader}>
                <View style={[styles.dot, { backgroundColor: colors.red }]} />
                <Text style={styles.expLabel}>{i18n.t('expenses')}</Text>
              </View>
              <Text style={styles.expAmount}>₪ {totalExpense.toLocaleString()}</Text>
            </View>
          </View>
        </Card>
 
        {/* Top Categories */}
        {topCategories.length > 0 && (
          <View style={styles.quickStats}>
            {topCategories.map(([cat, amount], idx) => {
              const catColor = colors.categories[cat] || colors.textMuted;
              return (
                <View key={cat} style={styles.quickStatItem}>
                  <View style={[styles.quickStatBar, { backgroundColor: catColor }]} />
                  <Text style={styles.quickStatLabel} numberOfLines={1}>{i18n.t(cat)}</Text>
                  <Text style={styles.quickStatAmount}>₪{amount}</Text>
                </View>
              );
            })}
          </View>
        )}
 
        {/* Recent Transactions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{i18n.t('recentTransactions')}</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>{i18n.t('seeAll')}</Text>
          </TouchableOpacity>
        </View>
 
        <Card>
          {recentTx.length > 0 ? (
            recentTx.map((tx) => (
              <TransactionItem key={tx.id} transaction={tx} />
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📊</Text>
              <Text style={styles.emptyText}>{i18n.t('noTransactions')}</Text>
            </View>
          )}
        </Card>
      </ScrollView>
 
      {/* FAB */}
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
    paddingHorizontal: 24, paddingTop: 60, paddingBottom: 24,
  },
  logo: { color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -1 },
  logoQ: { color: colors.green },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  avatarWrap: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.cardBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 20 },
 
  balanceLabel: { color: colors.textDim, fontSize: 13, marginBottom: 8, letterSpacing: 0.5 },
  balanceAmount: { fontSize: 40, fontWeight: '800', letterSpacing: -1.5, marginBottom: 24 },
  balancePositive: { color: colors.text },
  balanceNegative: { color: colors.red },
  incExpRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.cardHighlight, borderRadius: 14, padding: 16,
  },
  incExpItem: { flex: 1 },
  incExpHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  divider: { width: 1, height: 40, backgroundColor: colors.divider, marginHorizontal: 16 },
  incLabel: { color: colors.green, fontSize: 12, fontWeight: '600' },
  incAmount: { color: colors.green, fontSize: 20, fontWeight: '700', paddingLeft: 14 },
  expLabel: { color: colors.red, fontSize: 12, fontWeight: '600' },
  expAmount: { color: colors.red, fontSize: 20, fontWeight: '700', paddingLeft: 14 },
 
  quickStats: { flexDirection: 'row', paddingHorizontal: 24, gap: 8, marginTop: 4, marginBottom: 8 },
  quickStatItem: {
    flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: colors.cardBorder,
  },
  quickStatBar: { height: 3, borderRadius: 2, marginBottom: 8, width: '60%' },
  quickStatLabel: { color: colors.textDim, fontSize: 10, fontWeight: '600', marginBottom: 2 },
  quickStatAmount: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
 
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, marginTop: 28, marginBottom: 12,
  },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  seeAll: { color: colors.green, fontSize: 13, fontWeight: '600' },
 
  emptyContainer: { alignItems: 'center', paddingVertical: 36 },
  emptyIcon: { fontSize: 36, marginBottom: 12 },
  emptyText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
 
  fab: {
    position: 'absolute', right: 24, bottom: 100,
    width: 60, height: 60, borderRadius: 18, backgroundColor: colors.green,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.green, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  fabText: { color: colors.bg, fontSize: 30, fontWeight: '700', marginTop: -2 },
});