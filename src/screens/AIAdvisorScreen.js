// src/screens/AIAdvisorScreen.js
// Умный финансовый советник — инсайты, налоги, прогнозы, дневной бюджет
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Card from '../components/Card';
import i18n from '../i18n';
import aiService from '../services/aiService';
import dataService from '../services/dataService';
import { colors } from '../theme/colors';
import Amount from '../components/Amount';
import { fmt } from '../utils/currency';

export default function AIAdvisorScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [geminiTips, setGeminiTips] = useState(null);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const st = createStyles();

  const loadData = async () => {
    const [txs, budgets, accounts, recurring] = await Promise.all([
      dataService.getTransactions(),
      dataService.getBudgets(),
      dataService.getAccounts(),
      dataService.getRecurring(),
    ]);

    const analysis = aiService.generateInsights(txs, budgets, accounts, recurring);
    const daily = aiService.calculateDailyBudget(txs, budgets);
    const taxReserve = analysis.income > 0 ? aiService.calculateTaxReserve(analysis.income) : null;

    setData({ ...analysis, daily, taxReserve, _txs: txs, _budgets: budgets });
    setLoading(false);

    // Gemini advice (async, не блокирует UI)
    if (txs.length > 0 && !geminiTips) {
      setGeminiLoading(true);
      const tips = await aiService.getPersonalAdvice(txs, budgets, i18n.getLanguage());
      if (tips) setGeminiTips(tips);
      setGeminiLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));
  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const typeColors = {
    positive: colors.green,
    warning: colors.yellow,
    negative: colors.red,
    info: colors.blue,
  };

  if (loading) {
    return (
      <View style={[st.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.green} />
        <Text style={st.loadingText}>{i18n.t('aiAnalyzing')}</Text>
      </View>
    );
  }

  const { insights, income, expense, balance, savingsRate, daily, taxReserve, cashFlow } = data || {};

  return (
    <View style={st.container}>
      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
        contentContainerStyle={{ paddingBottom: 100 }}>

        <View style={st.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
            <Feather name={i18n.backIcon()} size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={st.title}>{i18n.t('advisor')}</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* ─── Summary ──────────────────────── */}
        <Card highlighted style={{ marginHorizontal: 20 }}>
          <View style={st.summaryRow}>
            <View style={st.summaryItem}>
              <Text style={st.summaryLabel}>{i18n.t('income')}</Text>
              <Amount value={income || 0} style={[st.summaryValue, { color: colors.green }]} numberOfLines={1} adjustsFontSizeToFit />
            </View>
            <View style={st.summaryDivider} />
            <View style={st.summaryItem}>
              <Text style={st.summaryLabel}>{i18n.t('expenses')}</Text>
              <Amount value={expense || 0} style={[st.summaryValue, { color: colors.red }]} numberOfLines={1} adjustsFontSizeToFit />
            </View>
            <View style={st.summaryDivider} />
            <View style={st.summaryItem}>
              <Text style={st.summaryLabel}>{i18n.t('savings')}</Text>
              <Text style={[st.summaryValue, { color: (balance || 0) >= 0 ? colors.green : colors.red }]}>
                {savingsRate || 0}%
              </Text>
            </View>
          </View>
        </Card>

        {/* ─── Daily Budget ─────────────────── */}
        {daily && (
          <Card style={{ marginHorizontal: 20, marginTop: 12 }}>
            <View style={st.dailyRow}>
              <View style={[st.dailyIcon, { backgroundColor: colors.greenSoft }]}>
                <Feather name="sun" size={22} color={colors.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.dailyLabel}>{i18n.t('aiDailyBudget')}</Text>
                <Text style={st.dailyAmount}><Amount value={daily.dailyBudget} style={st.dailyAmount} /><Text style={st.dailySub}> / {i18n.t('day')}</Text></Text>
                <Text style={st.dailyMeta}>
                  {daily.daysLeft} {i18n.t('daysLeft')} · {i18n.t('remaining')}: {fmt(daily.remaining)}
                </Text>
                {daily.savedYesterday > 0 && (
                  <View style={st.savedRow}>
                    <Feather name="award" size={14} color={colors.green} />
                    <Text style={st.savedText}>
                      {i18n.t('aiSavedYesterday').replace('{amount}', fmt(daily.savedYesterday))}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Card>
        )}

        {/* ─── Tax Reserve (for income) ─────── */}
        {taxReserve && taxReserve.grossIncome > 0 && (
          <>
            <View style={st.sectionTitleRow}>
              <Feather name="shield" size={16} color={colors.yellow} />
              <Text style={st.sectionTitle}>{i18n.t('aiTaxSafe')}</Text>
            </View>
            <Card style={{ marginHorizontal: 20 }}>
              <Text style={st.taxDesc}>{i18n.t('aiTaxSafeDesc')}</Text>
              <View style={st.taxGrid}>
                <View style={st.taxItem}>
                  <Text style={st.taxItemLabel}>{i18n.t('grossIncome')}</Text>
                  <Amount value={taxReserve.grossIncome} style={st.taxItemValue} color={colors.green} />
                </View>
                <View style={st.taxItem}>
                  <Text style={st.taxItemLabel}>{i18n.t('maam')} (17%)</Text>
                  <Amount value={-taxReserve.maam} sign style={st.taxItemValue} color={colors.red} />
                </View>
                <View style={st.taxItem}>
                  <Text style={st.taxItemLabel}>{i18n.t('incomeTax')} (~10%)</Text>
                  <Amount value={-taxReserve.incomeTax} sign style={st.taxItemValue} color={colors.red} />
                </View>
                <View style={st.taxItem}>
                  <Text style={st.taxItemLabel}>{i18n.t('bituachLeumi')} (~7%)</Text>
                  <Amount value={-taxReserve.bituach} sign style={st.taxItemValue} color={colors.red} />
                </View>
              </View>
              <View style={st.taxTotal}>
                <Text style={st.taxTotalLabel}>{i18n.t('netIncome')}</Text>
                <Amount value={taxReserve.netIncome} style={st.taxTotalValue} />
              </View>
              <View style={st.taxBar}>
                <View style={[st.taxBarFill, { flex: taxReserve.netIncome, backgroundColor: colors.green }]} />
                <View style={[st.taxBarFill, { flex: taxReserve.totalReserve, backgroundColor: colors.red + '80' }]} />
              </View>
              <View style={st.taxLegend}>
                <View style={st.legendItem}><View style={[st.legendDot, { backgroundColor: colors.green }]} /><Text style={st.legendText}>{i18n.t('yours')}</Text></View>
                <View style={st.legendItem}><View style={[st.legendDot, { backgroundColor: colors.red + '80' }]} /><Text style={st.legendText}>{i18n.t('taxReserve')}</Text></View>
              </View>
            </Card>
          </>
        )}

        {/* ─── Cash Flow Prediction ─────────── */}
        {cashFlow && cashFlow.upcoming.length > 0 && (
          <>
            <View style={st.sectionTitleRow}>
              <Feather name="activity" size={16} color={colors.blue} />
              <Text style={st.sectionTitle}>{i18n.t('aiCashFlow')}</Text>
            </View>
            <Card style={{ marginHorizontal: 20 }}>
              <View style={st.cfSummary}>
                <View style={st.cfItem}>
                  <Text style={st.cfLabel}>{i18n.t('currentBalance')}</Text>
                  <Amount value={cashFlow.currentBalance} style={st.cfValue} color={colors.green} />
                </View>
                <Feather name="minus" size={16} color={colors.textMuted} />
                <View style={st.cfItem}>
                  <Text style={st.cfLabel}>{i18n.t('upcoming')}</Text>
                  <Amount value={cashFlow.totalUpcoming} style={st.cfValue} color={colors.red} />
                </View>
                <Feather name="arrow-right" size={16} color={colors.textMuted} />
                <View style={st.cfItem}>
                  <Text style={st.cfLabel}>{i18n.t('projected')}</Text>
                  <Amount value={cashFlow.projectedBalance} style={st.cfValue} color={cashFlow.projectedBalance >= 0 ? colors.green : colors.red} />
                </View>
              </View>
              {cashFlow.isAtRisk && (
                <View style={st.riskBanner}>
                  <Feather name="alert-octagon" size={16} color={colors.red} />
                  <Text style={st.riskText}>{i18n.t('aiCashFlowWarning')}</Text>
                </View>
              )}
              {cashFlow.upcoming.slice(0, 5).map((item, idx) => (
                <View key={idx} style={st.cfRow}>
                  <Text style={st.cfDate}>{item.date}</Text>
                  <Text style={st.cfName}>{i18n.t(item.name) || item.name}</Text>
                  <Amount
                    value={item.type === 'expense' ? -item.amount : item.amount}
                    sign={item.type === 'expense'}
                    style={st.cfAmount}
                    color={item.type === 'expense' ? colors.red : colors.green}
                  />
                </View>
              ))}
            </Card>
          </>
        )}

        {/* ─── Insights ─────────────────────── */}
        <View style={st.sectionTitleRow}>
          <Feather name="zap" size={16} color={colors.green} />
          <Text style={st.sectionTitle}>{i18n.t('aiInsights')}</Text>
        </View>

        {insights && insights.length > 0 ? insights.map((insight, idx) => {
          const color = typeColors[insight.type];
          return (
            <Card key={idx} style={{ marginHorizontal: 20 }}>
              <View style={st.insightRow}>
                <View style={[st.insightIcon, { backgroundColor: color + '15' }]}>
                  <Feather name={insight.icon} size={20} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.insightTitle}>{insight.title}</Text>
                  <Text style={st.insightText}>{insight.text}</Text>
                </View>
              </View>
            </Card>
          );
        }) : (
          <Card style={{ marginHorizontal: 20 }}>
            <View style={st.emptyWrap}>
              <Feather name="check-circle" size={32} color={colors.green} />
              <Text style={st.emptyText}>{i18n.t('aiAllGood')}</Text>
            </View>
          </Card>
        )}

        {/* ─── Gemini Personal Advice ─────── */}
        {(geminiTips || geminiLoading) && (
          <>
            <View style={st.sectionTitleRow}>
              <Feather name="cpu" size={16} color={colors.blue} />
              <Text style={st.sectionTitle}>{i18n.t('aiPersonalAdvice')}</Text>
            </View>
            {geminiLoading ? (
              <Card style={{ marginHorizontal: 20 }}>
                <View style={st.emptyWrap}>
                  <ActivityIndicator size="small" color={colors.blue} />
                  <Text style={st.emptyText}>{i18n.t('aiThinking')}</Text>
                </View>
              </Card>
            ) : geminiTips?.map((tip, idx) => {
              const color = typeColors[tip.type] || colors.blue;
              return (
                <Card key={`gemini-${idx}`} style={{ marginHorizontal: 20 }}>
                  <View style={st.insightRow}>
                    <View style={[st.insightIcon, { backgroundColor: color + '15' }]}>
                      <Feather name={tip.icon || 'star'} size={20} color={color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.insightTitle}>{tip.title}</Text>
                      <Text style={st.insightText}>{tip.text}</Text>
                    </View>
                  </View>
                </Card>
              );
            })}
          </>
        )}

        {/* ─── Tips ─────────────────────────── */}
        <View style={st.sectionTitleRow}>
          <Feather name="book-open" size={16} color={colors.teal} />
          <Text style={st.sectionTitle}>{i18n.t('aiTip')}</Text>
        </View>
        {[
          { icon: '🛒', titleKey: 'aiTip1Title', textKey: 'aiTip1Text' },
          { icon: '🛡️', titleKey: 'aiTip5Title', textKey: 'aiTip5Text' },
        ].map((tip, idx) => (
          <Card key={idx} style={{ marginHorizontal: 20 }}>
            <View style={st.tipRow}>
              <Text style={st.tipIcon}>{tip.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={st.tipTitle}>{i18n.t(tip.titleKey)}</Text>
                <Text style={st.tipText}>{i18n.t(tip.textKey).replace(/\{sym\}/g, require('../utils/currency').sym())}</Text>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', marginEnd: 14, borderWidth: 1, borderColor: colors.cardBorder },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', flex: 1, textAlign: 'center' },
  loadingText: { color: colors.textMuted, fontSize: 14, marginTop: 12 },

  summaryRow: { flexDirection: i18n.row(), alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, height: 36, backgroundColor: colors.divider },
  summaryLabel: { color: colors.textDim, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  summaryValue: { fontSize: 14, fontWeight: '800' },

  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginTop: 28, marginBottom: 12 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },

  // Daily budget
  dailyRow: { flexDirection: i18n.row(), alignItems: 'flex-start', gap: 14 },
  dailyIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  dailyLabel: { color: colors.textDim, fontSize: 12, fontWeight: '600', marginBottom: 4, textAlign: i18n.textAlign() },
  dailyAmount: { color: colors.text, fontSize: 32, fontWeight: '800', textAlign: i18n.textAlign() },
  dailySub: { color: colors.textMuted, fontSize: 14, fontWeight: '500', textAlign: i18n.textAlign() },
  dailyMeta: { color: colors.textMuted, fontSize: 12, marginTop: 4, textAlign: i18n.textAlign() },
  savedRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: colors.greenSoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  savedText: { color: colors.green, fontSize: 12, fontWeight: '600' },

  // Tax reserve
  taxDesc: { color: colors.textDim, fontSize: 12, lineHeight: 20, marginBottom: 16, textAlign: i18n.textAlign() },
  taxGrid: { gap: 10, marginBottom: 16 },
  taxItem: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'center' },
  taxItemLabel: { color: colors.textSecondary, fontSize: 14, fontWeight: '500', textAlign: i18n.textAlign() },
  taxItemValue: { fontSize: 14, fontWeight: '700' },
  taxTotal: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.divider, marginBottom: 12 },
  taxTotalLabel: { color: colors.text, fontSize: 16, fontWeight: '700', textAlign: i18n.textAlign() },
  taxTotalValue: { color: colors.green, fontSize: 20, fontWeight: '800' },
  taxBar: { flexDirection: i18n.row(), height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 10 },
  taxBarFill: { height: 10 },
  taxLegend: { flexDirection: i18n.row(), gap: 20 },
  legendItem: { flexDirection: i18n.row(), alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.textDim, fontSize: 12, fontWeight: '500' },

  // Cash flow
  cfSummary: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  cfItem: { alignItems: 'center', flex: 1 },
  cfLabel: { color: colors.textDim, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  cfValue: { fontSize: 14, fontWeight: '700' },
  cfRow: { flexDirection: i18n.row(), alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.divider },
  cfDate: { color: colors.textMuted, fontSize: 12, fontWeight: '600', width: 30 },
  cfName: { flex: 1, color: colors.textSecondary, fontSize: 14, fontWeight: '500', marginStart: 10, textAlign: i18n.textAlign() },
  cfAmount: { fontSize: 14, fontWeight: '700' },
  riskBanner: { flexDirection: i18n.row(), alignItems: 'center', gap: 8, backgroundColor: colors.redSoft, borderRadius: 12, padding: 12, marginBottom: 12 },
  riskText: { color: colors.red, fontSize: 12, fontWeight: '600', flex: 1, textAlign: i18n.textAlign() },

  // Insights
  insightRow: { flexDirection: i18n.row(), alignItems: 'flex-start', gap: 14 },
  insightIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  insightTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 4, textAlign: i18n.textAlign() },
  insightText: { color: colors.textDim, fontSize: 12, lineHeight: 20, textAlign: i18n.textAlign() },
  emptyWrap: { alignItems: 'center', paddingVertical: 24, gap: 12 },
  emptyText: { color: colors.textDim, fontSize: 14, fontWeight: '600' },

  // Tips
  tipRow: { flexDirection: i18n.row(), alignItems: 'flex-start', gap: 10 },
  tipIcon: { fontSize: 20 },
  tipTitle: { color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 4, textAlign: i18n.textAlign() },
  tipText: { color: colors.textDim, fontSize: 12, lineHeight: 20, textAlign: i18n.textAlign() },
});
