// src/components/MonthDetailModal.js
// Детализация месяца: pie chart + категории + переход к транзакциям
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import i18n from '../i18n';
import { colors } from '../theme/colors';
import SwipeModal from './SwipeModal';
import InteractivePieChart from './InteractivePieChart';
import Amount from './Amount';
import { getCatName, getCatIcon, CatIcon } from './CategoryPickerModal';
import { getCachedGroups } from './CategoryIcon';

export default function MonthDetailModal({ visible, onClose, monthInfo, transactions, onShowTransactions }) {
  const lang = i18n.getLanguage();
  const groups = getCachedGroups();
  const st = createSt();

  const { income, expense, pieData, catRows } = useMemo(() => {
    if (!monthInfo) return { income: 0, expense: 0, pieData: [], catRows: [] };
    const mTxs = transactions.filter(t => {
      const d = new Date(t.date || t.createdAt);
      return d.getMonth() === monthInfo.monthIndex && d.getFullYear() === monthInfo.year;
    });
    const inc = mTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = mTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    const totals = {};
    const nameMap = {};
    mTxs.filter(t => t.type === 'expense').forEach(t => {
      const cat = t.categoryId || 'other';
      totals[cat] = (totals[cat] || 0) + t.amount;
      if (t.categoryName) nameMap[cat] = t.categoryName;
    });

    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const pie = sorted.slice(0, 6).map(([cat, amount]) => {
      const { color } = getCatIcon(cat, groups);
      return { name: nameMap[cat] || getCatName(cat, groups, lang), amount, color, legendFontColor: colors.textDim, legendFontSize: 11 };
    });
    const rows = sorted.map(([cat, amount]) => ({
      cat,
      name: nameMap[cat] || getCatName(cat, groups, lang),
      amount,
      pct: exp > 0 ? Math.round((amount / exp) * 100) : 0,
      ...getCatIcon(cat, groups),
    }));
    return { income: inc, expense: exp, pieData: pie, catRows: rows };
  }, [monthInfo, transactions, groups, lang]);

  if (!monthInfo) return null;

  const title = `${monthInfo.month} ${monthInfo.year}`;

  return (
    <SwipeModal visible={visible} onClose={onClose}>
      <View style={st.container}>
        <Text style={st.title}>{title}</Text>

        <View style={st.summaryRow}>
          <View style={st.summaryItem}>
            <View style={[st.summaryDot, { backgroundColor: colors.green }]} />
            <Text style={st.summaryLabel}>{i18n.t('income')}</Text>
            <Amount value={income} style={[st.summaryValue, { color: colors.green }]} />
          </View>
          <View style={st.summaryItem}>
            <View style={[st.summaryDot, { backgroundColor: colors.red }]} />
            <Text style={st.summaryLabel}>{i18n.t('expenses')}</Text>
            <Amount value={-expense} sign style={[st.summaryValue, { color: colors.red }]} />
          </View>
        </View>

        {/* Sticky pie (stays in place while user scrolls the category list) */}
        {pieData.length > 0 && (
          <View style={st.pieWrap}>
            <InteractivePieChart data={pieData} size={180} hideLegend />
          </View>
        )}

        <ScrollView style={st.list} showsVerticalScrollIndicator={false}>
          {catRows.length === 0 ? (
            <Text style={st.empty}>{i18n.t('noData') || '—'}</Text>
          ) : (
            catRows.map(row => (
              <View key={row.cat} style={st.catRow}>
                <View style={[st.catIconWrap, { backgroundColor: row.color + '18' }]}>
                  <CatIcon icon={row.icon} size={18} color={row.color} />
                </View>
                <Text style={st.catName} numberOfLines={1}>{row.name}</Text>
                <Amount value={row.amount} style={st.catAmount} />
                <Text style={st.catPct}>{row.pct}%</Text>
              </View>
            ))
          )}

          <TouchableOpacity style={st.txBtn} onPress={() => { onClose(); onShowTransactions && onShowTransactions(monthInfo); }} activeOpacity={0.7}>
            <Feather name="list" size={16} color={colors.green} />
            <Text style={st.txBtnText}>{i18n.t('transactions')}</Text>
            <Feather name={i18n.isRTL() ? 'chevron-left' : 'chevron-right'} size={16} color={colors.green} />
          </TouchableOpacity>
        </ScrollView>
      </View>
    </SwipeModal>
  );
}

const createSt = () => StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, maxHeight: '85%' },
  title: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 12, textAlign: i18n.textAlign() },
  summaryRow: { flexDirection: i18n.row(), gap: 12, marginBottom: 12 },
  summaryItem: { flex: 1, backgroundColor: colors.bg2, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.cardBorder },
  summaryDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 6 },
  summaryLabel: { color: colors.textDim, fontSize: 12, fontWeight: '600', marginBottom: 4, textAlign: i18n.textAlign() },
  summaryValue: { fontSize: 14, fontWeight: '700', textAlign: i18n.textAlign() },
  list: { flex: 1 },
  pieWrap: { alignItems: 'center', marginBottom: 8 },
  catRow: { flexDirection: i18n.row(), alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 12 },
  catIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  catName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '500', textAlign: i18n.textAlign() },
  catAmount: { color: colors.text, fontSize: 14, fontWeight: '700' },
  catPct: { color: colors.textDim, fontSize: 12, fontWeight: '600', minWidth: 34, textAlign: 'right' },
  empty: { color: colors.textDim, fontSize: 14, textAlign: 'center', marginVertical: 24 },
  txBtn: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.green + '18', borderRadius: 12, paddingVertical: 14, marginTop: 16, marginBottom: 8 },
  txBtnText: { color: colors.green, fontSize: 14, fontWeight: '700' },
});
