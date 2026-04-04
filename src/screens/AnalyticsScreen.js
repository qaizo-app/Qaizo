// src/screens/AnalyticsScreen.js
// Аналитика — инсайты, ציון פיננסי, графики
import React, { useCallback, useState } from 'react';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Amount from '../components/Amount';
import Card from '../components/Card';
import i18n from '../i18n';
import analyticsService from '../services/analyticsService';
import dataService from '../services/dataService';
import badgeService from '../services/badgeService';
import streakService from '../services/streakService';
import { categoryConfig, colors } from '../theme/colors';
import { sym } from '../utils/currency';

export default function AnalyticsScreen() {
  const navigation = useNavigation();
  const [insights, setInsights] = useState([]);
  const [score, setScore] = useState(50);
  const [topPayees, setTopPayees] = useState([]);
  const [monthCompare, setMonthCompare] = useState([]);
  const [dayData, setDayData] = useState([]);
  const [earnedBadges, setEarnedBadges] = useState([]);
  const st = createSt();
  const lang = i18n.getLanguage();

  const dayLabels = lang === 'he'
    ? ['א','ב','ג','ד','ה','ו','ש']
    : lang === 'ru'
    ? ['Вс','Пн','Вт','Ср','Чт','Пт','Сб']
    : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  useFocusEffect(useCallback(() => {
    (async () => {
      const [txs, budgets, goals] = await Promise.all([
        dataService.getTransactions(),
        dataService.getBudgets(),
        dataService.getGoals(),
      ]);
      const recurring = await dataService.getRecurring();
      const streakData = await streakService.calculateStreak(txs);
      setInsights(analyticsService.generateInsights(txs, recurring, budgets, goals));
      setScore(analyticsService.getFinancialScore(txs, budgets, goals));
      setEarnedBadges(badgeService.getEarnedBadges(streakData, txs, budgets, goals));
      setTopPayees(analyticsService.getTopPayees(txs, 1));
      setMonthCompare(analyticsService.getMonthComparison(txs));
      setDayData(analyticsService.getExpenseByDayOfWeek(txs, 3));
    })();
  }, []));

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
        <View style={st.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
            <Feather name={i18n.backIcon()} size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={st.title}>{i18n.t('analytics')}</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* ציון פיננסי */}
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

        {/* הישגים */}
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

        {/* תובנות */}
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

        {/* השוואת חודשים */}
        {monthCompare.length > 0 && (
          <Card>
            <Text style={st.sectionTitle}>{i18n.t('monthComparison')}</Text>
            {monthCompare.slice(0, 6).map((item, idx) => {
              const cfg = categoryConfig[item.categoryId] || categoryConfig.other;
              const catName = i18n.t(item.categoryId);
              return (
                <View key={idx} style={[st.compareRow, idx < Math.min(monthCompare.length, 6) - 1 && st.compareBorder]}>
                  <View style={[st.compareDot, { backgroundColor: cfg.color }]} />
                  <Text style={st.compareName} numberOfLines={1}>{catName}</Text>
                  <Amount value={item.current} style={st.compareAmount} />
                  <Text style={[st.compareChange, { color: item.change > 0 ? colors.red : item.change < 0 ? colors.green : colors.textMuted }]}>
                    {item.change > 0 ? '+' : ''}{item.change}%
                  </Text>
                </View>
              );
            })}
          </Card>
        )}

        {/* Top מוטבים */}
        {topPayees.length > 0 && (
          <Card>
            <Text style={st.sectionTitle}>{i18n.t('topPayees')}</Text>
            {topPayees.map((p, idx) => (
              <View key={idx} style={[st.payeeRow, idx < topPayees.length - 1 && st.payeeBorder]}>
                <Text style={st.payeeRank}>{idx + 1}</Text>
                <Text style={st.payeeName} numberOfLines={1}>{p.name}</Text>
                <Amount value={p.amount} style={st.payeeAmount} />
              </View>
            ))}
          </Card>
        )}

        {/* הוצאות לפי יום */}
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
      </ScrollView>
    </View>
  );
}

const createSt = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },

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
  compareChange: { fontSize: 13, fontWeight: '700', width: 50, textAlign: 'right' },

  // Top payees
  payeeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  payeeBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  payeeRank: { color: colors.textMuted, fontSize: 14, fontWeight: '700', width: 20 },
  payeeName: { color: colors.textSecondary, fontSize: 14, fontWeight: '500', flex: 1 },
  payeeAmount: { fontSize: 14, fontWeight: '600', color: colors.text },

  // Day chart
  dayChart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120, gap: 4 },
  dayCol: { flex: 1, alignItems: 'center' },
  dayAmount: { color: colors.textMuted, fontSize: 9, fontWeight: '600', marginBottom: 4 },
  dayBarBg: { width: '100%', height: 80, backgroundColor: colors.bg2, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  dayBarFill: { width: '100%', backgroundColor: colors.green, borderRadius: 6 },
  dayLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '600', marginTop: 4 },
});
