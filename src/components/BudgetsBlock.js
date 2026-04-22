// src/components/BudgetsBlock.js
// Блок бюджетов с прогресс-барами по категориям
import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Amount from './Amount';
import Card from './Card';
import i18n from '../i18n';
import { categoryConfig, colors } from '../theme/colors';
import { sym } from '../utils/currency';
import { catName } from '../utils/categoryName';

export default function BudgetsBlock({
  budgetRows,
  hasBudgets,
  totalBudgetSpent,
  totalBudgetLimit,
  totalBudgetPct,
  catNameMap,
  expanded,
  onToggle,
  onBudgetPress,
}) {
  if (budgetRows.length === 0) return null;
  return (
    <Card>
      <TouchableOpacity style={st.blockTitleRow} onPress={onToggle} activeOpacity={0.7}>
        <Text style={st.blockTitle}>{i18n.t('budgets')}</Text>
        <View style={st.budgetTitleRight}>
          {hasBudgets && (
            <Text style={[st.totalPct, { color: totalBudgetPct > 100 ? colors.red : totalBudgetPct > 80 ? colors.yellow : colors.green }]}>
              {totalBudgetPct}%
            </Text>
          )}
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
        </View>
      </TouchableOpacity>
      {hasBudgets && (
        <>
          <View style={st.totalBudgetRow}>
            <Text style={st.totalBudgetLabel}>{i18n.t('totalBudget')}</Text>
            <Text style={st.totalBudgetAmount}>
              {totalBudgetSpent.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()} / {totalBudgetLimit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()}
            </Text>
          </View>
          <View style={st.barBgThick}>
            <View style={[st.barFillThick, {
              width: `${Math.min(totalBudgetPct, 100)}%`,
              backgroundColor: totalBudgetPct > 100 ? colors.red : totalBudgetPct > 80 ? colors.yellow : colors.green,
            }]} />
          </View>
          <Text style={st.totalBudgetLeft}>
            {totalBudgetPct <= 100
              ? `${i18n.t('left')}: ${(totalBudgetLimit - totalBudgetSpent).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${sym()}`
              : `${i18n.t('over')}: ${(totalBudgetSpent - totalBudgetLimit).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${sym()}`
            }
          </Text>
        </>
      )}
      {expanded && (
        <View style={hasBudgets ? { marginTop: 16, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 16 } : undefined}>
          {budgetRows.map(({ cat, spent, limit, hasBudget: hb }) => {
            const cfg = categoryConfig[cat] || categoryConfig.other;
            const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
            const barColor = !hb ? cfg.color : pct > 100 ? colors.red : pct > 80 ? colors.yellow : cfg.color;
            return (
              <TouchableOpacity key={cat} style={st.budgetRow}
                onPress={() => onBudgetPress({ categoryId: cat, spent })} activeOpacity={0.6}>
                <View style={st.budgetInfo}>
                  <View style={st.budgetLeft}>
                    <View style={[st.budgetDot, { backgroundColor: cfg.color }]} />
                    <Text style={st.budgetCat} numberOfLines={1}>{catNameMap[cat] || catName(cat)}</Text>
                  </View>
                  <View style={st.budgetRight}>
                    {hb ? (
                      <>
                        <Text style={[st.budgetPct, { color: barColor }]}>{pct}%</Text>
                        <Text style={st.budgetAmount}>{spent.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()} / {limit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()}</Text>
                      </>
                    ) : (
                      <>
                        <Amount value={spent} style={st.budgetAmount} />
                        <Feather name="plus-circle" size={14} color={colors.textMuted} style={{ marginStart: 6 }} />
                      </>
                    )}
                  </View>
                </View>
                <View style={st.barBg}>
                  {hb ? (
                    <View style={[st.barFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }]} />
                  ) : (
                    <View style={[st.barFill, { width: '100%', backgroundColor: cfg.color, opacity: 0.3 }]} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </Card>
  );
}

const st = StyleSheet.create({
  blockTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 12, textAlign: i18n.textAlign() },
  blockTitleRow: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  totalPct: { fontSize: 14, fontWeight: '700' },
  budgetTitleRight: { flexDirection: i18n.row(), alignItems: 'center', gap: 8 },
  totalBudgetRow: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  totalBudgetLabel: { color: colors.textSecondary, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  totalBudgetAmount: { color: colors.textDim, fontSize: 12, fontWeight: '600', writingDirection: 'ltr', flexShrink: 0 },
  barBgThick: { height: 10, backgroundColor: colors.bg2, borderRadius: 5, overflow: 'hidden', marginBottom: 8 },
  barFillThick: { height: 10, borderRadius: 5 },
  totalBudgetLeft: { color: colors.textMuted, fontSize: 12, fontWeight: '500', writingDirection: 'ltr' },
  budgetRow: { marginBottom: 16 },
  budgetInfo: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  budgetLeft: { flexDirection: i18n.row(), alignItems: 'center', gap: 8 },
  budgetRight: { flexDirection: i18n.row(), alignItems: 'center' },
  budgetDot: { width: 8, height: 8, borderRadius: 4 },
  budgetCat: { color: colors.textSecondary, fontSize: 14, fontWeight: '600', textAlign: i18n.textAlign(), flexShrink: 1, maxWidth: '60%' },
  budgetPct: { fontSize: 12, fontWeight: '700', marginEnd: 8 },
  budgetAmount: { color: colors.textDim, fontSize: 12, fontWeight: '600', writingDirection: 'ltr' },
  barBg: { height: 6, backgroundColor: colors.bg2, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
});
