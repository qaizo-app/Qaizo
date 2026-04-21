// src/components/InteractiveBarChart.js
// Interactive bar chart for 6-month income/expense comparison
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import i18n from '../i18n';
import Amount from './Amount';

function formatAmount(n) {
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

export default function InteractiveBarChart({ data, maxBar, onBarActivate }) {
  const [selected, setSelected] = useState(null);
  const animValues = useRef(data.map(() => new Animated.Value(0))).current;
  const st = createSt();

  useEffect(() => {
    const anims = animValues.map((val, idx) =>
      Animated.timing(val, { toValue: 1, duration: 400, delay: idx * 60, useNativeDriver: false })
    );
    Animated.stagger(60, anims).start();
  }, []);

  const selectedData = selected !== null ? data[selected] : null;

  return (
    <View>
      {/* Tooltip */}
      {selectedData && (
        <TouchableOpacity style={st.tooltip} activeOpacity={onBarActivate ? 0.7 : 1}
          onPress={() => onBarActivate && onBarActivate(selectedData)}>
          <View style={st.tooltipHeader}>
            <Text style={st.tooltipMonth}>{selectedData.month}</Text>
            {onBarActivate && (
              <View style={st.tooltipHint}>
                <Text style={st.tooltipHintText}>{i18n.t('details')}</Text>
                <Feather name={i18n.isRTL() ? 'chevron-left' : 'chevron-right'} size={14} color={colors.green} />
              </View>
            )}
          </View>
          <View style={st.tooltipRow}>
            <View style={[st.tooltipDot, { backgroundColor: colors.green }]} />
            <Text style={st.tooltipLabel}>{i18n.t('income')}:</Text>
            <Amount value={selectedData.income} style={st.tooltipVal} color={colors.green} />
          </View>
          <View style={st.tooltipRow}>
            <View style={[st.tooltipDot, { backgroundColor: colors.red }]} />
            <Text style={st.tooltipLabel}>{i18n.t('expenses')}:</Text>
            <Amount value={-selectedData.expense} sign style={st.tooltipVal} color={colors.red} />
          </View>
        </TouchableOpacity>
      )}

      {/* Chart */}
      <View style={st.chart}>
        {data.map((d, idx) => {
          const isSelected = selected === idx;
          const incH = Math.max((d.income / maxBar) * 100, 2);
          const expH = Math.max((d.expense / maxBar) * 100, 2);

          return (
            <TouchableOpacity
              key={idx}
              style={[st.barGroup, isSelected && st.barGroupActive]}
              onPress={() => {
                if (selected === idx && onBarActivate) onBarActivate(d);
                else setSelected(idx);
              }}
              onLongPress={() => onBarActivate && onBarActivate(d)}
              activeOpacity={0.7}
            >
              {/* Amount labels on top */}
              {(d.income > 0 || d.expense > 0) && (
                <View style={st.barLabels}>
                  {d.income > 0 && <Text style={[st.barAmount, { color: colors.green }]}>{formatAmount(d.income)}</Text>}
                  {d.expense > 0 && <Text style={[st.barAmount, { color: colors.red }]}>{formatAmount(d.expense)}</Text>}
                </View>
              )}

              <View style={st.barsWrap}>
                <Animated.View style={[st.bar, st.barIncome, {
                  height: animValues[idx].interpolate({
                    inputRange: [0, 1],
                    outputRange: [2, incH],
                  }),
                  opacity: selected !== null && !isSelected ? 0.4 : 1,
                }]} />
                <Animated.View style={[st.bar, st.barExpense, {
                  height: animValues[idx].interpolate({
                    inputRange: [0, 1],
                    outputRange: [2, expH],
                  }),
                  opacity: selected !== null && !isSelected ? 0.4 : 1,
                }]} />
              </View>
              <Text style={[st.barLabel, isSelected && st.barLabelActive]}>{d.month}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Legend */}
      <View style={st.legend}>
        <View style={st.legendItem}>
          <View style={[st.legendDot, { backgroundColor: colors.green }]} />
          <Text style={st.legendText}>{i18n.t('income')}</Text>
        </View>
        <View style={st.legendItem}>
          <View style={[st.legendDot, { backgroundColor: colors.red }]} />
          <Text style={st.legendText}>{i18n.t('expenses')}</Text>
        </View>
      </View>
    </View>
  );
}

const createSt = () => StyleSheet.create({
  tooltip: { backgroundColor: colors.bg2, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.cardBorder },
  tooltipHeader: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  tooltipMonth: { color: colors.text, fontSize: 14, fontWeight: '700', textAlign: i18n.textAlign() },
  tooltipHint: { flexDirection: i18n.row(), alignItems: 'center', gap: 2 },
  tooltipHintText: { color: colors.green, fontSize: 12, fontWeight: '600' },
  tooltipRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 6, marginTop: 2 },
  tooltipDot: { width: 8, height: 8, borderRadius: 4 },
  tooltipLabel: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  tooltipVal: { fontSize: 12, fontWeight: '700' },

  chart: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'flex-end', height: 140, paddingTop: 24 },
  barGroup: { flex: 1, alignItems: 'center', paddingVertical: 4, borderRadius: 8 },
  barGroupActive: { backgroundColor: colors.bg2 },
  barLabels: { alignItems: 'center', marginBottom: 4, minHeight: 14 },
  barAmount: { fontSize: 10, fontWeight: '700' },
  barsWrap: { flexDirection: i18n.row(), alignItems: 'flex-end', gap: 3, marginBottom: 8 },
  bar: { width: 16, borderRadius: 4, minHeight: 2 },
  barIncome: { backgroundColor: colors.green },
  barExpense: { backgroundColor: colors.red },
  barLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  barLabelActive: { color: colors.text, fontWeight: '700' },

  legend: { flexDirection: i18n.row(), justifyContent: 'center', gap: 20, marginTop: 12 },
  legendItem: { flexDirection: i18n.row(), alignItems: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginEnd: 6 },
  legendText: { color: colors.textDim, fontSize: 12, fontWeight: '500' },
});
