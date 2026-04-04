// src/screens/AnalyticsScreen.js
// Аналитика — табы: Обзор | Расходы | Тренды + селектор периода
import React, { useCallback, useState } from 'react';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Amount from '../components/Amount';
import BalanceLineChart from '../components/BalanceLineChart';
import Card from '../components/Card';
import CashFlowChart from '../components/CashFlowChart';
import InteractivePieChart from '../components/InteractivePieChart';
import i18n from '../i18n';
import analyticsService from '../services/analyticsService';
import dataService from '../services/dataService';
import badgeService from '../services/badgeService';
import streakService from '../services/streakService';
import { categoryConfig, colors } from '../theme/colors';
import { sym } from '../utils/currency';

const PERIODS = [
  { key: '7d', days: 7, label: '7D' },
  { key: '30d', days: 30, label: '30D' },
  { key: '3m', days: 90, label: '3M' },
  { key: '6m', days: 180, label: '6M' },
  { key: '1y', days: 365, label: '1Y' },
];

const TABS = ['overview', 'expenses', 'trends'];

export default function AnalyticsScreen() {
  const navigation = useNavigation();
  const [tab, setTab] = useState('overview');
  const [periodIdx, setPeriodIdx] = useState(1); // default 30d
  const [allTxs, setAllTxs] = useState([]);

  // Overview data
  const [insights, setInsights] = useState([]);
  const [score, setScore] = useState(50);
  const [earnedBadges, setEarnedBadges] = useState([]);

  // Expenses data
  const [pieData, setPieData] = useState([]);
  const [topPayees, setTopPayees] = useState([]);
  const [monthCompare, setMonthCompare] = useState([]);
  const [dayData, setDayData] = useState([]);

  // Trends data
  const [balanceHistory, setBalanceHistory] = useState([]);
  const [cashFlowData, setCashFlowData] = useState([]);
  const [quickStats, setQuickStats] = useState(null);
  const [accountBalances, setAccountBalances] = useState([]);

  const st = createSt();
  const lang = i18n.getLanguage();
  const period = PERIODS[periodIdx];

  const dayLabels = lang === 'he'
    ? ['א','ב','ג','ד','ה','ו','ש']
    : lang === 'ru'
    ? ['Вс','Пн','Вт','Ср','Чт','Пт','Сб']
    : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  useFocusEffect(useCallback(() => {
    loadData();
  }, [periodIdx]));

  const loadData = async () => {
    try {
      const [txs, budgets, goals] = await Promise.all([
        dataService.getTransactions(),
        dataService.getBudgets(),
        dataService.getGoals(),
      ]);
      const recurring = await dataService.getRecurring();
      setAllTxs(txs);

      if (__DEV__) console.log('Analytics: loaded', txs.length, 'txs, period:', period.days, 'days');

      // Overview
      try {
        const streakData = await streakService.updateStreaks(txs);
        setInsights(analyticsService.generateInsights(txs, recurring, budgets, goals));
        setScore(analyticsService.getFinancialScore(txs, budgets, goals));
        setEarnedBadges(badgeService.getEarnedBadges(streakData, txs, budgets, goals));
      } catch (e) { if (__DEV__) console.error('Analytics overview error:', e); }

      // Expenses
      try {
        // Pie chart data — group by category for period
        const periodTxs = analyticsService.filterByPeriod(txs, period.days);
        const catTotals = {};
        periodTxs.filter(t => t.type === 'expense').forEach(t => {
          const cat = t.categoryId || 'other';
          catTotals[cat] = (catTotals[cat] || 0) + t.amount;
        });
        const PIE_COLORS = ['#fb7185', '#34d399', '#60a5fa', '#fbbf24', '#a78bfa', '#22d3ee', '#f472b6', '#4ade80'];
        const pie = Object.entries(catTotals)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([cat, amount], idx) => ({
            name: i18n.t(cat) !== cat ? i18n.t(cat) : cat,
            amount,
            color: (categoryConfig[cat] || {}).color || PIE_COLORS[idx % PIE_COLORS.length],
          }));
        setPieData(pie);

        setTopPayees(analyticsService.getTopPayees(txs, Math.max(1, Math.ceil(period.days / 30))));
        setMonthCompare(analyticsService.getMonthComparison(txs));
        setDayData(analyticsService.getExpenseByDayOfWeek(txs, Math.max(1, Math.ceil(period.days / 30))));
      } catch (e) { if (__DEV__) console.error('Analytics expenses error:', e); }

      // Trends
      try {
        const bh = analyticsService.getBalanceHistory(txs, period.days);
        if (__DEV__) console.log('Balance history:', bh.length, 'points');
        setBalanceHistory(bh);
      } catch (e) { if (__DEV__) console.error('Balance history error:', e); }

      try {
        const cf = analyticsService.getCashFlow(txs, period.days);
        if (__DEV__) console.log('Cash flow:', cf.length, 'points');
        setCashFlowData(cf);
      } catch (e) { if (__DEV__) console.error('Cash flow error:', e); }

      try {
        const qs = analyticsService.getQuickStats(txs, period.days);
        setQuickStats(qs);
      } catch (e) { if (__DEV__) console.error('Quick stats error:', e); }

      // Account balances
      try {
        const accounts = await dataService.getAccounts();
        const ACCOUNT_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];
        const sorted = [...accounts]
          .filter(a => a.balance !== 0)
          .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
        setAccountBalances(sorted.map((a, idx) => ({
          name: a.name,
          balance: a.balance,
          color: ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length],
          type: a.type,
        })));
      } catch (e) { if (__DEV__) console.error('Account balances error:', e); }

    } catch (e) {
      if (__DEV__) console.error('Analytics loadData error:', e);
    }
  };

  const scoreLabel = score >= 80 ? i18n.t('scoreExcellent') : score >= 60 ? i18n.t('scoreGood') : score >= 40 ? i18n.t('scoreFair') : i18n.t('scorePoor');
  const scoreColor = score >= 80 ? colors.green : score >= 60 ? '#34d399' : score >= 40 ? colors.yellow : colors.red;

  const formatInsight = (insight) => {
    let text = i18n.t(insight.titleKey);
    if (insight.params) {
      for (const [k, v] of Object.entries(insight.params)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  };

  const maxDay = Math.max(...dayData.map(d => d.avg), 1);

  return (
    <View style={st.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Header */}
        <View style={st.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
            <Feather name={i18n.backIcon()} size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={st.title}>{i18n.t('analytics')}</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Period selector */}
        <View style={st.periodRow}>
          {PERIODS.map((p, idx) => (
            <TouchableOpacity key={p.key}
              style={[st.periodBtn, periodIdx === idx && st.periodActive]}
              onPress={() => setPeriodIdx(idx)} activeOpacity={0.7}>
              <Text style={[st.periodText, periodIdx === idx && st.periodTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tabs */}
        <View style={st.tabsRow}>
          {TABS.map(t => (
            <TouchableOpacity key={t} style={[st.tabBtn, tab === t && st.tabActive]}
              onPress={() => setTab(t)} activeOpacity={0.7}>
              <Text style={[st.tabText, tab === t && st.tabTextActive]}>
                {i18n.t(t === 'overview' ? 'tabOverview' : t === 'expenses' ? 'tabExpenses' : 'tabTrends')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* === OVERVIEW TAB === */}
        {tab === 'overview' && (
          <>
            {/* Financial score */}
            <Card highlighted>
              <Text style={st.sectionTitle}>{i18n.t('financialScore')}</Text>
              <View style={st.scoreRow}>
                <View style={st.scoreCircle}>
                  <Text style={[st.scoreNum, { color: scoreColor }]}>{score}</Text>
                </View>
                <View style={st.scoreInfo}>
                  <Text style={[st.scoreLabel, { color: scoreColor }]}>{scoreLabel}</Text>
                  <View style={st.scoreBar}>
                    <View style={[st.scoreBarFill, { width: `${score}%`, backgroundColor: scoreColor }]} />
                  </View>
                </View>
              </View>
            </Card>

            {/* Badges */}
            <Card>
              <Text style={st.sectionTitle}>{i18n.t('badges')}</Text>
              <View style={st.badgeGrid}>
                {badgeService.getAllBadges().map(badge => {
                  const isEarned = earnedBadges.includes(badge.id);
                  const isIon = badge.icon.startsWith('ion:');
                  return (
                    <View key={badge.id} style={[st.badgeItem, !isEarned && st.badgeLocked]}>
                      <View style={[st.badgeIcon, { backgroundColor: isEarned ? badge.color + '20' : colors.bg2 }]}>
                        {isIon
                          ? <Ionicons name={badge.icon.slice(4)} size={22} color={isEarned ? badge.color : colors.textMuted} />
                          : <Feather name={badge.icon} size={20} color={isEarned ? badge.color : colors.textMuted} />
                        }
                      </View>
                      <Text style={[st.badgeLabel, isEarned && { color: colors.text }]} numberOfLines={2}>{i18n.t(badge.titleKey)}</Text>
                    </View>
                  );
                })}
              </View>
            </Card>

            {/* Insights */}
            <Card>
              <Text style={st.sectionTitle}>{i18n.t('insights')}</Text>
              {insights.length === 0 ? (
                <Text style={st.emptyText}>{i18n.t('noInsights')}</Text>
              ) : (
                insights.map((ins, idx) => (
                  <View key={idx} style={[st.insightRow, idx < insights.length - 1 && st.insightBorder]}>
                    <View style={[st.insightIcon, { backgroundColor: ins.color + '18' }]}>
                      <Feather name={ins.icon} size={18} color={ins.color} />
                    </View>
                    <Text style={st.insightText}>{formatInsight(ins)}</Text>
                  </View>
                ))
              )}
            </Card>
          </>
        )}

        {/* === EXPENSES TAB === */}
        {tab === 'expenses' && (
          <>
            {pieData.length === 0 && monthCompare.length === 0 && topPayees.length === 0 && (
              <Card><Text style={st.emptyText}>{i18n.t('noInsights')}</Text></Card>
            )}

            {/* Pie chart */}
            {pieData.length > 0 && (
              <Card>
                <Text style={st.sectionTitle}>{i18n.t('expensesByCategory')}</Text>
                <InteractivePieChart data={pieData} />
              </Card>
            )}

            {/* Month comparison */}
            {monthCompare.length > 0 && (
              <Card>
                <Text style={st.sectionTitle}>{i18n.t('monthComparison')}</Text>
                {monthCompare.slice(0, 8).map((item, idx) => {
                  const cfg = categoryConfig[item.categoryId] || categoryConfig.other;
                  const catName = i18n.t(item.categoryId);
                  const maxAmount = Math.max(...monthCompare.slice(0, 8).map(m => m.current), 1);
                  return (
                    <View key={idx} style={[st.compareRow, idx < Math.min(monthCompare.length, 8) - 1 && st.compareBorder]}>
                      <View style={[st.compareDot, { backgroundColor: cfg.color }]} />
                      <Text style={st.compareName} numberOfLines={1}>{catName}</Text>
                      <Amount value={item.current} style={st.compareAmount} />
                      <View style={[st.changeBadge, {
                        backgroundColor: item.change > 0 ? colors.redSoft : item.change < 0 ? colors.greenSoft : colors.bg2
                      }]}>
                        <Text style={[st.changeText, {
                          color: item.change > 0 ? colors.red : item.change < 0 ? colors.green : colors.textMuted
                        }]}>
                          {item.change > 0 ? '+' : ''}{item.change}%
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </Card>
            )}

            {/* Top payees */}
            {topPayees.length > 0 && (
              <Card>
                <Text style={st.sectionTitle}>{i18n.t('topPayees')}</Text>
                {topPayees.map((p, idx) => {
                  const maxPayee = topPayees[0]?.amount || 1;
                  return (
                    <View key={idx} style={[st.payeeRow, idx < topPayees.length - 1 && st.payeeBorder]}>
                      <Text style={st.payeeRank}>{idx + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <View style={st.payeeInfo}>
                          <Text style={st.payeeName} numberOfLines={1}>{p.name}</Text>
                          <Amount value={p.amount} style={st.payeeAmount} />
                        </View>
                        <View style={st.payeeBarBg}>
                          <View style={[st.payeeBarFill, { width: `${(p.amount / maxPayee) * 100}%` }]} />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </Card>
            )}

            {/* Day of week */}
            {dayData.some(d => d.avg > 0) && (
              <Card>
                <Text style={st.sectionTitle}>{i18n.t('expenseByDay')}</Text>
                <View style={st.dayChart}>
                  {dayData.map((d, idx) => (
                    <View key={idx} style={st.dayCol}>
                      <Text style={st.dayAmount}>{d.avg > 0 ? d.avg : ''}</Text>
                      <View style={st.dayBarBg}>
                        <View style={[st.dayBarFill, { height: `${(d.avg / maxDay) * 100}%` }]} />
                      </View>
                      <Text style={st.dayLabel}>{dayLabels[idx]}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            )}
          </>
        )}

        {/* === TRENDS TAB === */}
        {tab === 'trends' && (
          <>
            {/* Quick stats */}
            {quickStats && (
              <Card>
                <Text style={st.sectionTitle}>{i18n.t('quickOverview')}</Text>
                <View style={st.statsGrid}>
                  <View style={st.statItem}>
                    <Text style={st.statLabel}>{i18n.t('income')}</Text>
                    <Amount value={quickStats.totalIncome} style={[st.statValue, { color: colors.green }]} />
                    {quickStats.incomeChange !== 0 && (
                      <Text style={[st.statChange, { color: quickStats.incomeChange > 0 ? colors.green : colors.red }]}>
                        {quickStats.incomeChange > 0 ? '+' : ''}{quickStats.incomeChange}%
                      </Text>
                    )}
                  </View>
                  <View style={st.statItem}>
                    <Text style={st.statLabel}>{i18n.t('expenses')}</Text>
                    <Amount value={quickStats.totalExpense} style={[st.statValue, { color: colors.red }]} />
                    {quickStats.expenseChange !== 0 && (
                      <Text style={[st.statChange, { color: quickStats.expenseChange > 0 ? colors.red : colors.green }]}>
                        {quickStats.expenseChange > 0 ? '+' : ''}{quickStats.expenseChange}%
                      </Text>
                    )}
                  </View>
                  <View style={st.statItem}>
                    <Text style={st.statLabel}>{i18n.t('totalTransactions')}</Text>
                    <Text style={st.statValue}>{quickStats.totalTx}</Text>
                  </View>
                  <View style={st.statItem}>
                    <Text style={st.statLabel}>{i18n.t('avgPerDay')}</Text>
                    <Amount value={quickStats.avgPerDay} style={st.statValue} />
                  </View>
                  <View style={st.statItem}>
                    <Text style={st.statLabel}>{i18n.t('avgPerTx')}</Text>
                    <Amount value={quickStats.avgPerTx} style={st.statValue} />
                  </View>
                  <View style={st.statItem}>
                    <Text style={st.statLabel}>{i18n.t('netFlow')}</Text>
                    <Amount value={quickStats.netFlow} style={[st.statValue, { color: quickStats.netFlow >= 0 ? colors.green : colors.red }]} sign />
                  </View>
                </View>
              </Card>
            )}

            {/* Balance history */}
            {balanceHistory.length > 0 && (
              <Card>
                <Text style={st.sectionTitle}>{i18n.t('balanceHistory')}</Text>
                <BalanceLineChart data={balanceHistory} />
              </Card>
            )}

            {/* Cash flow */}
            {cashFlowData.length > 0 && quickStats && (
              <Card>
                <Text style={st.sectionTitle}>{i18n.t('cashFlow')}</Text>
                <CashFlowChart data={cashFlowData}
                  totalIncome={quickStats.totalIncome}
                  totalExpense={quickStats.totalExpense} />
              </Card>
            )}

            {/* Balance by accounts */}
            {accountBalances.length > 0 && (
              <Card>
                <Text style={st.sectionTitle}>{i18n.t('balanceByAccounts')}</Text>
                {(() => {
                  const maxBal = Math.max(...accountBalances.map(a => Math.abs(a.balance)), 1);
                  const totalBal = accountBalances.reduce((s, a) => s + a.balance, 0);
                  return (
                    <>
                      <Amount value={totalBal} style={st.accountTotal} sign />
                      {accountBalances.map((a, idx) => (
                        <View key={idx} style={[st.accountRow, idx < accountBalances.length - 1 && st.accountBorder]}>
                          <View style={{ flex: 1 }}>
                            <View style={st.accountInfo}>
                              <Text style={st.accountName} numberOfLines={1}>{a.name}</Text>
                              <Amount value={a.balance} style={[st.accountAmount, { color: a.balance >= 0 ? colors.green : colors.red }]} sign />
                            </View>
                            <View style={st.accountBarBg}>
                              <View style={[st.accountBarFill, {
                                width: `${(Math.abs(a.balance) / maxBal) * 100}%`,
                                backgroundColor: a.color,
                              }]} />
                            </View>
                          </View>
                        </View>
                      ))}
                    </>
                  );
                })()}
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createSt = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 8 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },

  // Tabs
  tabsRow: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 12, backgroundColor: colors.card, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: colors.cardBorder },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: colors.green },
  tabText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: colors.bg, fontWeight: '700' },

  // Period selector
  periodRow: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 12, backgroundColor: colors.card, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: colors.cardBorder },
  periodBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  periodActive: { backgroundColor: colors.green },
  periodText: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  periodTextActive: { color: colors.bg, fontWeight: '700' },

  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 14 },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 16 },

  // Badges
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badgeItem: { width: '18%', alignItems: 'center', gap: 4, paddingVertical: 8 },
  badgeLocked: { opacity: 0.35 },
  badgeIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  badgeLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '600', textAlign: 'center' },

  // Score
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  scoreCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.bg2, justifyContent: 'center', alignItems: 'center' },
  scoreNum: { fontSize: 24, fontWeight: '800' },
  scoreInfo: { flex: 1 },
  scoreLabel: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  scoreBar: { height: 8, backgroundColor: colors.bg2, borderRadius: 4, overflow: 'hidden' },
  scoreBarFill: { height: 8, borderRadius: 4 },

  // Insights
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  insightBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  insightIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  insightText: { color: colors.textSecondary, fontSize: 14, fontWeight: '500', flex: 1, lineHeight: 20 },

  // Month comparison
  compareRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  compareBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  compareDot: { width: 8, height: 8, borderRadius: 4 },
  compareName: { color: colors.textSecondary, fontSize: 14, fontWeight: '500', flex: 1 },
  compareAmount: { fontSize: 14, fontWeight: '600', color: colors.text },
  changeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, minWidth: 48, alignItems: 'center' },
  changeText: { fontSize: 12, fontWeight: '700' },

  // Top payees
  payeeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  payeeBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  payeeRank: { color: colors.textMuted, fontSize: 16, fontWeight: '800', width: 22 },
  payeeInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  payeeName: { color: colors.textSecondary, fontSize: 14, fontWeight: '500', flex: 1 },
  payeeAmount: { fontSize: 14, fontWeight: '600', color: colors.text },
  payeeBarBg: { height: 4, backgroundColor: colors.bg2, borderRadius: 2, overflow: 'hidden' },
  payeeBarFill: { height: 4, borderRadius: 2, backgroundColor: colors.green },

  // Day chart
  dayChart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120, gap: 4, direction: 'ltr' },
  dayCol: { flex: 1, alignItems: 'center' },
  dayAmount: { color: colors.textMuted, fontSize: 9, fontWeight: '600', marginBottom: 4 },
  dayBarBg: { width: '100%', height: 80, backgroundColor: colors.bg2, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  dayBarFill: { width: '100%', backgroundColor: colors.green, borderRadius: 6 },
  dayLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '600', marginTop: 4 },

  // Account balances
  accountTotal: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 14 },
  accountRow: { paddingVertical: 10 },
  accountBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  accountInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  accountName: { color: colors.textSecondary, fontSize: 14, fontWeight: '500', flex: 1 },
  accountAmount: { fontSize: 14, fontWeight: '700' },
  accountBarBg: { height: 6, backgroundColor: colors.bg2, borderRadius: 3, overflow: 'hidden' },
  accountBarFill: { height: 6, borderRadius: 3 },

  // Quick stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statItem: { width: '46%', backgroundColor: colors.bg2, borderRadius: 12, padding: 14 },
  statLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '500', marginBottom: 4 },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '700' },
  statChange: { fontSize: 12, fontWeight: '700', marginTop: 2 },
});
