// src/screens/MonthlyReportScreen.js
// Полный месячный отчёт: доходы, расходы, топ категории, топ получатели, динамика
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Card from '../components/Card';
import DailyExpensesChart from '../components/DailyExpensesChart';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { categoryConfig, colors } from '../theme/colors';
import { sym } from '../utils/currency';

const SW = Dimensions.get('window').width;

export default function MonthlyReportScreen() {
  const [transactions, setTransactions] = useState([]);
  const [monthOffset, setMonthOffset] = useState(0); // 0 = текущий, -1 = прошлый

  const st = createSt();

  useFocusEffect(useCallback(() => {
    dataService.getTransactions().then(txs => { setTransactions(txs); });
  }, []));

  const lang = i18n.getLanguage();
  const now = new Date();
  const viewMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const viewYear = viewMonth.getFullYear();
  const viewM = viewMonth.getMonth();

  const fullMonths = {
    ru: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
    he: ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'],
    en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  };
  const monthLabel = `${(fullMonths[lang] || fullMonths.en)[viewM]} ${viewYear}`;
  const isCurrentMonth = monthOffset === 0;

  // Транзакции за выбранный месяц
  const monthTxs = transactions.filter(t => {
    const d = new Date(t.date || t.createdAt);
    return d.getMonth() === viewM && d.getFullYear() === viewYear;
  });

  const incTxs = monthTxs.filter(t => t.type === 'income');
  const expTxs = monthTxs.filter(t => t.type === 'expense');
  const totalIncome = incTxs.reduce((s, t) => s + t.amount, 0);
  const totalExpense = expTxs.reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;
  const txCount = monthTxs.length;

  // Предыдущий месяц для сравнения
  const prevMonth = new Date(viewYear, viewM - 1, 1);
  const prevTxs = transactions.filter(t => {
    const d = new Date(t.date || t.createdAt);
    return d.getMonth() === prevMonth.getMonth() && d.getFullYear() === prevMonth.getFullYear();
  });
  const prevExpense = prevTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const expDiff = prevExpense > 0 ? Math.round(((totalExpense - prevExpense) / prevExpense) * 100) : 0;

  // Топ категории расходов
  const catTotals = {};
  expTxs.forEach(t => {
    const cat = t.categoryId || 'other';
    catTotals[cat] = (catTotals[cat] || 0) + t.amount;
  });
  const topCats = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Топ получатели
  const recipTotals = {};
  expTxs.forEach(t => {
    const r = t.recipient || i18n.t(t.categoryId) || i18n.t('other');
    recipTotals[r] = (recipTotals[r] || 0) + t.amount;
  });
  const topRecipients = Object.entries(recipTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Расходы по дням (для мини-графика)
  const daysInMonth = new Date(viewYear, viewM + 1, 0).getDate();
  const dailyExp = new Array(daysInMonth).fill(0);
  expTxs.forEach(t => {
    const d = new Date(t.date || t.createdAt).getDate();
    if (d >= 1 && d <= daysInMonth) dailyExp[d - 1] += t.amount;
  });
  // Доходы по категориям
  const incCatTotals = {};
  incTxs.forEach(t => {
    const cat = t.categoryId || 'other_income';
    incCatTotals[cat] = (incCatTotals[cat] || 0) + t.amount;
  });
  const topIncCats = Object.entries(incCatTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Средний расход в день
  const daysPassed = isCurrentMonth ? now.getDate() : daysInMonth;
  const avgDaily = daysPassed > 0 ? Math.round(totalExpense / daysPassed) : 0;

  return (
    <View style={st.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Header + навигация по месяцам */}
        <View style={st.header}>
          <Text style={st.title}>{i18n.t('monthlyReport')}</Text>
        </View>

        <View style={st.monthNav}>
          <TouchableOpacity style={st.navBtn} onPress={() => setMonthOffset(monthOffset - 1)}>
            <Feather name={i18n.isRTL() ? 'chevron-right' : 'chevron-left'} size={22} color={colors.textDim} />
          </TouchableOpacity>
          <Text style={st.monthLabel}>{monthLabel}</Text>
          <TouchableOpacity style={[st.navBtn, isCurrentMonth && { opacity: 0.3 }]}
            onPress={() => !isCurrentMonth && setMonthOffset(monthOffset + 1)} disabled={isCurrentMonth}>
            <Feather name={i18n.isRTL() ? 'chevron-left' : 'chevron-right'} size={22} color={colors.textDim} />
          </TouchableOpacity>
        </View>

        {/* Сводка */}
        <Card highlighted>
          <View style={st.summaryRow}>
            <View style={st.summaryItem}>
              <Text style={st.summaryLabel}>{i18n.t('income')}</Text>
              <Text style={[st.summaryAmount, { color: colors.green }]} numberOfLines={1} adjustsFontSizeToFit>{totalIncome.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()}</Text>
            </View>
            <View style={st.summaryDivider} />
            <View style={st.summaryItem}>
              <Text style={st.summaryLabel}>{i18n.t('expenses')}</Text>
              <Text style={[st.summaryAmount, { color: colors.red }]} numberOfLines={1} adjustsFontSizeToFit>{totalExpense.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()}</Text>
            </View>
            <View style={st.summaryDivider} />
            <View style={st.summaryItem}>
              <Text style={st.summaryLabel}>{i18n.t('balance')}</Text>
              <Text style={[st.summaryAmount, { color: balance >= 0 ? colors.green : colors.red }]} numberOfLines={1} adjustsFontSizeToFit>{balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()}</Text>
            </View>
          </View>
        </Card>

        {/* Статистика */}
        <Card>
          <View style={st.statsGrid}>
            <View style={st.statBox}>
              <Feather name="hash" size={16} color={colors.blue} />
              <Text style={st.statValue}>{txCount}</Text>
              <Text style={st.statLabel}>{i18n.t('transactionsCount')}</Text>
            </View>
            <View style={st.statBox}>
              <Feather name="activity" size={16} color={colors.teal} />
              <Text style={st.statValue}>{avgDaily.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()}</Text>
              <Text style={st.statLabel}>{i18n.t('avgPerDay')}</Text>
            </View>
            <View style={st.statBox}>
              <Feather name={expDiff > 0 ? 'arrow-up' : 'arrow-down'} size={16}
                color={expDiff > 0 ? colors.red : colors.green} />
              <Text style={[st.statValue, { color: expDiff > 0 ? colors.red : colors.green }]}>
                {expDiff > 0 ? '+' : ''}{expDiff}%
              </Text>
              <Text style={st.statLabel}>{i18n.t('vsLastMonth')}</Text>
            </View>
          </View>
        </Card>

        {/* Мини-график расходов по дням */}
        {totalExpense > 0 && (
          <>
            <View style={st.sectionHeader}>
              <Text style={st.sectionTitle}>{i18n.t('dailyExpenses')}</Text>
            </View>
            <Card>
              <DailyExpensesChart dailyExp={dailyExp} avgDaily={avgDaily} daysInMonth={daysInMonth} />
            </Card>
          </>
        )}

        {/* Топ расходы по категориям */}
        {topCats.length > 0 && (
          <>
            <View style={st.sectionHeader}>
              <Text style={st.sectionTitle}>{i18n.t('topExpenseCategories')}</Text>
            </View>
            <Card>
              {topCats.map(([cat, amount], idx) => {
                const cfg = categoryConfig[cat] || categoryConfig.other;
                const pct = totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0;
                return (
                  <View key={cat} style={st.catRow}>
                    <View style={st.catLeft}>
                      <Text style={st.catRank}>{idx + 1}</Text>
                      <View style={[st.catDot, { backgroundColor: cfg.color }]} />
                      <Text style={st.catName}>{i18n.t(cat)}</Text>
                    </View>
                    <View style={st.catRight}>
                      <Text style={st.catPct}>{pct}%</Text>
                      <Text style={st.catAmount}>{amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()}</Text>
                    </View>
                  </View>
                );
              })}
            </Card>
          </>
        )}

        {/* Топ получатели */}
        {topRecipients.length > 0 && (
          <>
            <View style={st.sectionHeader}>
              <Text style={st.sectionTitle}>{i18n.t('topPayees')}</Text>
            </View>
            <Card>
              {topRecipients.map(([name, amount], idx) => (
                <View key={name} style={st.catRow}>
                  <View style={st.catLeft}>
                    <Text style={st.catRank}>{idx + 1}</Text>
                    <Feather name="user" size={14} color={colors.textMuted} />
                    <Text style={st.catName}>{name}</Text>
                  </View>
                  <Text style={st.catAmount}>{amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()}</Text>
                </View>
              ))}
            </Card>
          </>
        )}

        {/* Доходы по категориям */}
        {topIncCats.length > 0 && (
          <>
            <View style={st.sectionHeader}>
              <Text style={st.sectionTitle}>{i18n.t('incomeBreakdown')}</Text>
            </View>
            <Card>
              {topIncCats.map(([cat, amount]) => {
                const cfg = categoryConfig[cat] || categoryConfig.other;
                return (
                  <View key={cat} style={st.catRow}>
                    <View style={st.catLeft}>
                      <View style={[st.catDot, { backgroundColor: cfg.color }]} />
                      <Text style={st.catName}>{i18n.t(cat)}</Text>
                    </View>
                    <Text style={[st.catAmount, { color: colors.green }]}>{amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()}</Text>
                  </View>
                );
              })}
            </Card>
          </>
        )}

        {/* Пусто */}
        {txCount === 0 && (
          <View style={st.empty}>
            <Feather name="file-text" size={40} color={colors.textMuted} />
            <Text style={st.emptyTxt}>{i18n.t('noDataForMonth')}</Text>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const createSt = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 8 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', textAlign: i18n.textAlign() },

  monthNav: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 16 },
  navBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  monthLabel: { color: colors.text, fontSize: 17, fontWeight: '700' },

  summaryRow: { flexDirection: i18n.row(), alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, height: 36, backgroundColor: colors.divider },
  summaryLabel: { color: colors.textDim, fontSize: 11, fontWeight: '600', marginBottom: 4 },
  summaryAmount: { fontSize: 16, fontWeight: '800' },

  statsGrid: { flexDirection: i18n.row(), gap: 12 },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: colors.bg2, borderRadius: 12, gap: 4 },
  statValue: { color: colors.text, fontSize: 16, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '600', textAlign: 'center' },

  sectionHeader: { paddingHorizontal: 24, marginTop: 24, marginBottom: 10 },
  sectionTitle: { color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textAlign: i18n.textAlign() },

  catRow: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  catLeft: { flexDirection: i18n.row(), alignItems: 'center', flex: 1, gap: 8 },
  catRight: { flexDirection: i18n.row(), alignItems: 'center', gap: 8 },
  catRank: { color: colors.textMuted, fontSize: 12, fontWeight: '700', width: 20, textAlign: 'center' },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catName: { color: colors.textSecondary, fontSize: 14, fontWeight: '600', textAlign: i18n.textAlign() },
  catPct: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  catAmount: { color: colors.textDim, fontSize: 14, fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTxt: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
});