// src/screens/DashboardScreen.js
// Графики: pie chart категорий, bar chart по месяцам, прогресс-бары бюджетов
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Dimensions, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import AddTransactionModal from '../components/AddTransactionModal';
import Card from '../components/Card';
import ConfirmModal from '../components/ConfirmModal';
import TransactionItem from '../components/TransactionItem';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { categoryConfig, colors } from '../theme/colors';

const SW = Dimensions.get('window').width;

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

  const lang = i18n.getLanguage();
  const now = new Date();
  const monthNames = {
    ru: ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'],
    he: ['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ'],
    en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  };
  const fullMonths = {
    ru: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
    he: ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'],
    en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  };
  const mNames = monthNames[lang] || monthNames.en;
  const dateStr = `${(fullMonths[lang] || fullMonths.en)[now.getMonth()]} ${now.getFullYear()}`;

  // This month transactions
  const thisMonth = transactions.filter(t => {
    const d = new Date(t.date || t.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const totalIncome = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;
  const recentTx = transactions.slice(0, 5);

  // ─── PIE CHART DATA ────────────────────────────────
  const catTotals = {};
  thisMonth.filter(t => t.type === 'expense').forEach(t => {
    const cat = t.categoryId || 'other';
    catTotals[cat] = (catTotals[cat] || 0) + t.amount;
  });
  const pieData = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([cat, amount]) => ({
      name: i18n.t(cat),
      amount,
      color: categoryConfig[cat]?.color || '#64748b',
      legendFontColor: colors.textDim,
      legendFontSize: 11,
    }));

  // ─── BAR CHART DATA (last 6 months) ────────────────
  const barData = [];
  for (let i = 5; i >= 0; i--) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mTxs = transactions.filter(t => {
      const d = new Date(t.date || t.createdAt);
      return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();
    });
    const inc = mTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = mTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    barData.push({ month: mNames[m.getMonth()], income: inc, expense: exp });
  }
  const maxBar = Math.max(...barData.map(d => Math.max(d.income, d.expense)), 1);

  // ─── BUDGET PROGRESS ──────────────────────────────
  const topCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 4);

  // ─── HANDLERS ──────────────────────────────────────
  const handleDelete = async () => {
    if (deleteTarget) { await dataService.deleteTransaction(deleteTarget.id); setDeleteTarget(null); await loadData(); }
  };
  const handleDuplicate = async (tx) => {
    await dataService.addTransaction({ ...tx, id: undefined, createdAt: undefined, date: new Date().toISOString(), note: tx.note ? `${tx.note} (copy)` : '(copy)' });
    await loadData();
  };
  const handleCloseModal = () => { setShowAdd(false); setEditTx(null); };

  return (
    <View style={st.container}>
      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
        contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Header */}
        <View style={st.header}>
          <View>
            <Text style={st.logo}><Text style={{ color: colors.green }}>Q</Text>aizo</Text>
            <Text style={st.subtitle}>{dateStr}</Text>
          </View>
          <TouchableOpacity style={st.profileBtn}>
            <Feather name="user" size={20} color={colors.textDim} />
          </TouchableOpacity>
        </View>

        {/* Balance */}
        <Card highlighted>
          <Text style={st.balLabel}>{i18n.t('totalBalance')}</Text>
          <Text style={[st.balAmount, { color: balance >= 0 ? colors.text : colors.red }]}>₪ {balance.toLocaleString()}</Text>
          <View style={st.incExpRow}>
            <View style={st.incExpItem}>
              <View style={st.incExpHead}>
                <Feather name="trending-up" size={14} color={colors.green} />
                <Text style={st.incLabel}> {i18n.t('income')}</Text>
              </View>
              <Text style={st.incAmount}>₪ {totalIncome.toLocaleString()}</Text>
            </View>
            <View style={st.divider} />
            <View style={st.incExpItem}>
              <View style={st.incExpHead}>
                <Feather name="trending-down" size={14} color={colors.red} />
                <Text style={st.expLabel}> {i18n.t('expenses')}</Text>
              </View>
              <Text style={st.expAmount}>₪ {totalExpense.toLocaleString()}</Text>
            </View>
          </View>
        </Card>

        {/* Pie Chart */}
        {pieData.length > 0 && (
          <>
            <View style={st.sectionHeader}>
              <Text style={st.sectionTitle}>
                {lang === 'ru' ? 'Расходы по категориям' : lang === 'he' ? 'הוצאות לפי קטגוריה' : 'Expenses by Category'}
              </Text>
            </View>
            <Card>
              <PieChart
                data={pieData}
                width={SW - 88}
                height={180}
                chartConfig={{ color: () => colors.textDim }}
                accessor="amount"
                backgroundColor="transparent"
                paddingLeft="0"
                center={[0, 0]}
                hasLegend={true}
                absolute
              />
            </Card>
          </>
        )}

        {/* Budget Progress Bars */}
        {topCats.length > 0 && (
          <>
            <View style={st.sectionHeader}>
              <Text style={st.sectionTitle}>
                {lang === 'ru' ? 'Топ расходы' : lang === 'he' ? 'הוצאות מובילות' : 'Top Expenses'}
              </Text>
            </View>
            <Card>
              {topCats.map(([cat, spent]) => {
                const cfg = categoryConfig[cat] || categoryConfig.other;
                const budget = spent * 1.3; // Условный лимит 130% от текущих трат
                const pct = Math.min((spent / budget) * 100, 100);
                const barColor = pct > 90 ? colors.red : pct > 70 ? colors.yellow : cfg.color;
                return (
                  <View key={cat} style={st.budgetRow}>
                    <View style={st.budgetInfo}>
                      <View style={st.budgetLeft}>
                        <View style={[st.budgetDot, { backgroundColor: cfg.color }]} />
                        <Text style={st.budgetCat}>{i18n.t(cat)}</Text>
                      </View>
                      <Text style={st.budgetAmount}>₪{spent.toLocaleString()}</Text>
                    </View>
                    <View style={st.barBg}>
                      <View style={[st.barFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                    </View>
                  </View>
                );
              })}
            </Card>
          </>
        )}

        {/* Bar Chart — 6 months */}
        {barData.some(d => d.income > 0 || d.expense > 0) && (
          <>
            <View style={st.sectionHeader}>
              <Text style={st.sectionTitle}>
                {lang === 'ru' ? '6 месяцев' : lang === 'he' ? '6 חודשים' : '6 Months'}
              </Text>
            </View>
            <Card>
              <View style={st.barChart}>
                {barData.map((d, idx) => (
                  <View key={idx} style={st.barGroup}>
                    <View style={st.barsWrap}>
                      <View style={[st.bar, st.barIncome, { height: Math.max((d.income / maxBar) * 100, 2) }]} />
                      <View style={[st.bar, st.barExpense, { height: Math.max((d.expense / maxBar) * 100, 2) }]} />
                    </View>
                    <Text style={st.barLabel}>{d.month}</Text>
                  </View>
                ))}
              </View>
              <View style={st.barLegend}>
                <View style={st.legendItem}>
                  <View style={[st.legendDot, { backgroundColor: colors.green }]} />
                  <Text style={st.legendText}>{i18n.t('income')}</Text>
                </View>
                <View style={st.legendItem}>
                  <View style={[st.legendDot, { backgroundColor: colors.red }]} />
                  <Text style={st.legendText}>{i18n.t('expenses')}</Text>
                </View>
              </View>
            </Card>
          </>
        )}

        {/* Recent Transactions */}
        <View style={st.sectionHeader}>
          <Text style={st.sectionTitle}>{i18n.t('recentTransactions')}</Text>
          <TouchableOpacity><Text style={st.seeAll}>{i18n.t('seeAll')}</Text></TouchableOpacity>
        </View>

        <Card>
          {recentTx.length > 0 ? recentTx.map(tx => (
            <TransactionItem key={tx.id} transaction={tx}
              onDelete={t => setDeleteTarget(t)}
              onEdit={t => setEditTx(t)}
              onDuplicate={handleDuplicate} />
          )) : (
            <View style={st.empty}>
              <Feather name="inbox" size={36} color={colors.textMuted} />
              <Text style={st.emptyText}>{i18n.t('noTransactions')}</Text>
            </View>
          )}
        </Card>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={st.fab} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
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

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 24 },
  logo: { color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -1 },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  profileBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, justifyContent: 'center', alignItems: 'center' },

  balLabel: { color: colors.textDim, fontSize: 13, marginBottom: 8 },
  balAmount: { fontSize: 38, fontWeight: '800', letterSpacing: -1.5, marginBottom: 24 },
  incExpRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardHighlight, borderRadius: 14, padding: 16 },
  incExpItem: { flex: 1 },
  incExpHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  divider: { width: 1, height: 40, backgroundColor: colors.divider, marginHorizontal: 16 },
  incLabel: { color: colors.green, fontSize: 12, fontWeight: '600' },
  incAmount: { color: colors.green, fontSize: 20, fontWeight: '700', paddingLeft: 4 },
  expLabel: { color: colors.red, fontSize: 12, fontWeight: '600' },
  expAmount: { color: colors.red, fontSize: 20, fontWeight: '700', paddingLeft: 4 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginTop: 28, marginBottom: 12 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  seeAll: { color: colors.green, fontSize: 13, fontWeight: '600' },

  // Budget bars
  budgetRow: { marginBottom: 16 },
  budgetInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  budgetLeft: { flexDirection: 'row', alignItems: 'center' },
  budgetDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  budgetCat: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  budgetAmount: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  barBg: { height: 6, backgroundColor: colors.card, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },

  // Bar chart
  barChart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120, paddingTop: 8 },
  barGroup: { flex: 1, alignItems: 'center' },
  barsWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginBottom: 8 },
  bar: { width: 14, borderRadius: 4, minHeight: 2 },
  barIncome: { backgroundColor: colors.green },
  barExpense: { backgroundColor: colors.red },
  barLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
  barLegend: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendText: { color: colors.textDim, fontSize: 11, fontWeight: '500' },

  empty: { alignItems: 'center', paddingVertical: 36 },
  emptyText: { color: colors.textMuted, fontSize: 15, fontWeight: '600', marginTop: 12 },

  fab: { position: 'absolute', right: 24, bottom: 100, width: 60, height: 60, borderRadius: 18, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center', shadowColor: colors.green, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10 },
});