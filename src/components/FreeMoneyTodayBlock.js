// src/components/FreeMoneyTodayBlock.js
// Калькулятор свободных денег на сегодня — расходы/доходы, прогноз, остаток
import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Amount from './Amount';
import Card from './Card';
import i18n from '../i18n';
import { colors } from '../theme/colors';
import { sym } from '../utils/currency';

export default function FreeMoneyTodayBlock({
  now,
  totalIncome,
  recurring,
  transactions,
  thisMonth,
  monthlyExtra,
  expanded,
  onToggle,
  onAddRecurring,
}) {
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(lastDay - now.getDate(), 1);

  // === ДОХОД ===
  // 1. Фактический доход этого месяца
  const monthIncome = totalIncome;

  // 2. Ожидаемый recurring income (ещё не поступивший)
  const expectedRecurringIncome = recurring
    .filter(r => r.isActive && r.type === 'income')
    .filter(r => {
      const nd = new Date(r.nextDate);
      return nd.getMonth() === now.getMonth() && nd.getFullYear() === now.getFullYear() && nd.getDate() > now.getDate();
    })
    .reduce((s, r) => s + r.amount, 0);

  // 3. Fallback: средний доход за 3 месяца (если нет recurring и мало дохода)
  let avgIncome3m = 0;
  if (monthIncome === 0 && expectedRecurringIncome === 0) {
    let totalInc3m = 0; let months3m = 0;
    for (let i = 1; i <= 3; i++) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mInc = transactions
        .filter(t => t.type === 'income')
        .filter(t => { const d = new Date(t.date || t.createdAt); return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear(); })
        .reduce((s, t) => s + t.amount, 0);
      if (mInc > 0) { totalInc3m += mInc; months3m++; }
    }
    if (months3m > 0) avgIncome3m = Math.round(totalInc3m / months3m);
  }

  const totalMonthIncome = monthIncome + expectedRecurringIncome + avgIncome3m;
  const hasNoIncomeData = totalMonthIncome === 0;

  // === ОБЯЗАТЕЛЬНЫЕ РАСХОДЫ ===
  const allRecurringExpenses = recurring
    .filter(r => r.isActive && r.type === 'expense')
    .reduce((s, r) => s + r.amount, 0);

  // === ПУЛ НА МЕСЯЦ ===
  const monthPool = totalMonthIncome - allRecurringExpenses + monthlyExtra;

  // === ГИБКИЕ ТРАТЫ (всё кроме recurring) ===
  const flexSpent = thisMonth
    .filter(t => t.type === 'expense' && !t.isTransfer)
    .reduce((s, t) => s + t.amount, 0);

  // === ОСТАТОК / ДНИ ===
  const remainingPool = monthPool - flexSpent;
  const freeToday = Math.floor(remainingPool / daysLeft);
  const isCrisis = monthPool <= 0 && !hasNoIncomeData;
  const freeTodayColor = hasNoIncomeData ? colors.textDim
    : isCrisis ? colors.orange
    : freeToday > 200 ? colors.green
    : freeToday > 50 ? colors.yellow
    : colors.red;

  // Spent today
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const spentToday = thisMonth
    .filter(t => t.type === 'expense' && new Date(t.date || t.createdAt) >= todayStart)
    .reduce((s, t) => s + t.amount, 0);

  // Yesterday comparison
  const yStart = new Date(todayStart); yStart.setDate(yStart.getDate() - 1);
  const spentYesterday = thisMonth
    .filter(t => t.type === 'expense')
    .filter(t => { const d = new Date(t.date || t.createdAt); return d >= yStart && d < todayStart; })
    .reduce((s, t) => s + t.amount, 0);
  const yesterdayBudget = remainingPool > 0 ? Math.floor((remainingPool + spentToday) / (daysLeft + 1)) : 0;
  const savedYesterday = yesterdayBudget - spentYesterday;

  // Progress bar: spent vs budget
  const absFree = Math.abs(freeToday) || 1;
  const pct = freeToday > 0 ? Math.min(Math.round((spentToday / absFree) * 100), 100) : 100;
  const barColor = pct > 80 ? colors.red : pct > 50 ? colors.yellow : colors.green;

  return (
    <Card>
      <TouchableOpacity style={st.freeTop} onPress={onToggle} activeOpacity={0.7}>
        <Feather name={hasNoIncomeData ? 'info' : isCrisis ? 'alert-triangle' : 'sun'} size={18} color={freeTodayColor} />
        <Text style={st.freeLabel}>{i18n.t('freeMoneyToday')}</Text>
        <Text style={st.freeDays}>{daysLeft} {i18n.t('daysLeft')}</Text>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </TouchableOpacity>

      {hasNoIncomeData && (
        <TouchableOpacity
          onPress={onAddRecurring}
          activeOpacity={0.7}
          style={{ backgroundColor: colors.blue + '12', borderRadius: 10, padding: 10, marginBottom: 8, flexDirection: i18n.row(), alignItems: 'center', gap: 6 }}
        >
          <Text style={{ color: colors.blue, fontSize: 12, fontWeight: '600', flex: 1 }}>{i18n.t('addIncomeHint')}</Text>
          <Feather name="chevron-right" size={14} color={colors.blue} />
        </TouchableOpacity>
      )}

      {isCrisis && !hasNoIncomeData && (
        <View style={{ backgroundColor: colors.orange + '15', borderRadius: 10, padding: 10, marginBottom: 8 }}>
          <Text style={{ color: colors.orange, fontSize: 12, fontWeight: '600' }}>{i18n.t('crisisWarning')}</Text>
        </View>
      )}

      <Amount value={freeToday} sign style={st.freeAmount} color={freeTodayColor} numberOfLines={1} adjustsFontSizeToFit />

      {/* Progress bar */}
      <View style={st.freeBar}>
        <View style={[st.freeBarFill, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>

      {/* Details row — collapsed by default */}
      {expanded && (
        <View style={st.freeDetails}>
          {spentToday > 0 && (
            <View style={st.freeDetail}>
              <Feather name="shopping-cart" size={12} color={colors.red} />
              <Text style={st.freeDetailTxt}>{i18n.t('spentToday')}: {spentToday.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()}</Text>
            </View>
          )}
          {allRecurringExpenses > 0 && (
            <View style={st.freeDetail}>
              <Feather name="repeat" size={12} color={colors.orange} />
              <Text style={st.freeDetailTxt}>{i18n.t('fixedExpenses')}: {allRecurringExpenses.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()}</Text>
            </View>
          )}
          {savedYesterday !== 0 && spentYesterday > 0 && (
            <View style={st.freeDetail}>
              <Feather name={savedYesterday > 0 ? 'trending-up' : 'trending-down'} size={12} color={savedYesterday > 0 ? colors.green : colors.red} />
              <Text style={[st.freeDetailTxt, { color: savedYesterday > 0 ? colors.green : colors.red }]}>
                {savedYesterday > 0 ? i18n.t('savedYesterday') : i18n.t('overspentYesterday')}: {Math.abs(savedYesterday).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()}
              </Text>
            </View>
          )}
        </View>
      )}
    </Card>
  );
}

const st = StyleSheet.create({
  freeTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  freeLabel: { color: colors.text, fontSize: 14, fontWeight: '700', flex: 1 },
  freeDays: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  freeAmount: { fontSize: 32, fontWeight: '800', letterSpacing: -1, marginBottom: 8, writingDirection: 'ltr' },
  freeBar: { height: 6, backgroundColor: colors.bg2, borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  freeBarFill: { height: 6, borderRadius: 3 },
  freeDetails: { gap: 4 },
  freeDetail: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  freeDetailTxt: { color: colors.textMuted, fontSize: 12, fontWeight: '600', flexShrink: 1 },
});
