// src/components/BalanceCard.js
// Карточка общего баланса с доходами/расходами и прогнозом на конец месяца
import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import Amount from './Amount';
import Card from './Card';
import i18n from '../i18n';
import { colors } from '../theme/colors';

export default function BalanceCard({ balance, totalIncome, totalExpense, now }) {
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const showForecast = dayOfMonth >= 3 && totalExpense > 0;

  let projectedBalance = 0;
  if (showForecast) {
    const dailyRate = totalExpense / dayOfMonth;
    const projectedExpense = Math.round(dailyRate * daysInMonth);
    projectedBalance = totalIncome - projectedExpense;
  }

  return (
    <Card highlighted>
      <Text style={st.balLabel}>{i18n.t('totalBalance')}</Text>
      <Amount value={balance} sign style={st.balAmount} color={balance >= 0 ? colors.text : colors.red} numberOfLines={1} adjustsFontSizeToFit />
      <View style={st.incExpRow}>
        <View style={st.incExpItem}>
          <View style={st.incExpHead}>
            <Feather name="trending-up" size={14} color={colors.green} />
            <Text style={st.incLabel}> {i18n.t('income')}</Text>
          </View>
          <Amount value={totalIncome} style={st.incAmount} color={colors.green} numberOfLines={1} adjustsFontSizeToFit />
        </View>
        <View style={st.dividerV} />
        <View style={st.incExpItem}>
          <View style={st.incExpHead}>
            <Feather name="trending-down" size={14} color={colors.red} />
            <Text style={st.expLabel}> {i18n.t('expenses')}</Text>
          </View>
          <Amount value={-totalExpense} sign style={st.expAmount} color={colors.red} numberOfLines={1} adjustsFontSizeToFit />
        </View>
      </View>

      {showForecast && (
        <View style={st.forecastRow}>
          <Feather name="activity" size={14} color={colors.textMuted} />
          <Text style={st.forecastText}>{i18n.t('endOfMonthForecast')}: </Text>
          <Amount value={projectedBalance} sign style={st.forecastAmount} color={projectedBalance >= 0 ? colors.green : colors.red} numberOfLines={1} adjustsFontSizeToFit />
        </View>
      )}
    </Card>
  );
}

const st = StyleSheet.create({
  balLabel: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 8, textAlign: i18n.isRTL() ? 'right' : 'left' },
  balAmount: { fontSize: 32, fontWeight: '800', letterSpacing: -1.5, marginBottom: 24, writingDirection: 'ltr' },
  forecastRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.divider, flexWrap: 'wrap' },
  forecastText: { color: colors.textMuted, fontSize: 12, fontWeight: '500', flexShrink: 1 },
  forecastAmount: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  incExpRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardHighlight, borderRadius: 14, padding: 16 },
  incExpItem: { flex: 1 },
  incExpHead: { flexDirection: i18n.row(), alignItems: 'center', marginBottom: 6 },
  dividerV: { width: 1, height: 40, backgroundColor: colors.divider, marginHorizontal: 16 },
  incLabel: { color: colors.green, fontSize: 12, fontWeight: '600' },
  incAmount: { color: colors.green, fontSize: 20, fontWeight: '700', paddingStart: 4, writingDirection: 'ltr' },
  expLabel: { color: colors.red, fontSize: 12, fontWeight: '600' },
  expAmount: { color: colors.red, fontSize: 20, fontWeight: '700', paddingStart: 4, writingDirection: 'ltr' },
});
