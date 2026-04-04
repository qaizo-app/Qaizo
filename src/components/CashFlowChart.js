// src/components/CashFlowChart.js
// Bar chart: daily income (green up) vs expense (red down) with Y-axis
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import Amount from './Amount';
import i18n from '../i18n';
import { colors } from '../theme/colors';

const CHART_H = 170;
const PAD_LEFT = 50;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOT = 24;
const MID_Y_RATIO = 0.45;

function formatK(n) {
  const abs = Math.abs(n);
  if (abs >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

export default function CashFlowChart({ data, totalIncome, totalExpense }) {
  const [containerW, setContainerW] = useState(300);
  const [selected, setSelected] = useState(null);

  if (!data || data.length < 2) return null;

  const chartW = containerW - PAD_LEFT - PAD_RIGHT;
  const h = CHART_H - PAD_TOP - PAD_BOT;
  const barW = Math.max(2, (chartW / data.length) - 1.5);
  const gap = 1;

  const maxIncome = Math.max(...data.map(d => d.income), 1);
  const maxExpense = Math.max(...data.map(d => d.expense), 1);
  const midY = PAD_TOP + h * MID_Y_RATIO;
  const incomeH = h * MID_Y_RATIO;
  const expenseH = h * (1 - MID_Y_RATIO);

  const handlePress = (evt) => {
    const x = evt.nativeEvent.locationX - PAD_LEFT;
    const idx = Math.floor(x / (barW + gap));
    if (idx >= 0 && idx < data.length) setSelected(idx);
  };

  const sel = selected !== null ? data[selected] : null;
  const netFlow = totalIncome - totalExpense;

  // X-axis label indices
  const labelCount = Math.min(4, data.length - 1);
  const labelIndices = [];
  for (let i = 0; i <= labelCount; i++) {
    labelIndices.push(Math.round((i / labelCount) * (data.length - 1)));
  }

  return (
    <View>
      {/* Summary */}
      <View style={st.summaryRow}>
        <View style={st.summaryItem}>
          <View style={[st.dot, { backgroundColor: colors.green }]} />
          <Text style={st.summaryLabel}>{i18n.t('income')}</Text>
          <Amount value={sel ? sel.income : totalIncome} style={st.summaryAmount} />
        </View>
        <View style={st.summaryItem}>
          <View style={[st.dot, { backgroundColor: colors.red }]} />
          <Text style={st.summaryLabel}>{i18n.t('expenses')}</Text>
          <Amount value={sel ? sel.expense : totalExpense} style={st.summaryAmount} />
        </View>
        <View style={st.summaryItem}>
          <Text style={[st.netAmount, { color: netFlow >= 0 ? colors.green : colors.red }]}>
            {netFlow >= 0 ? '+' : ''}{formatK(netFlow)}
          </Text>
        </View>
      </View>

      <TouchableOpacity activeOpacity={1} onPress={handlePress}
        onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}>
        <Svg width={containerW} height={CHART_H}>
          {/* Y-axis labels + grid */}
          {/* Max income */}
          <Line x1={PAD_LEFT} y1={PAD_TOP} x2={containerW - PAD_RIGHT} y2={PAD_TOP}
            stroke={colors.divider} strokeWidth={0.5} strokeDasharray="4,4" />
          <SvgText x={PAD_LEFT - 6} y={PAD_TOP + 4}
            fill={colors.green} fontSize={10} fontWeight="500" textAnchor="end">
            {formatK(maxIncome)}
          </SvgText>

          {/* Zero line */}
          <Line x1={PAD_LEFT} y1={midY} x2={containerW - PAD_RIGHT} y2={midY}
            stroke={colors.textMuted} strokeWidth={0.5} />
          <SvgText x={PAD_LEFT - 6} y={midY + 4}
            fill={colors.textMuted} fontSize={10} fontWeight="500" textAnchor="end">
            0
          </SvgText>

          {/* Max expense */}
          <Line x1={PAD_LEFT} y1={PAD_TOP + h} x2={containerW - PAD_RIGHT} y2={PAD_TOP + h}
            stroke={colors.divider} strokeWidth={0.5} strokeDasharray="4,4" />
          <SvgText x={PAD_LEFT - 6} y={PAD_TOP + h + 4}
            fill={colors.red} fontSize={10} fontWeight="500" textAnchor="end">
            -{formatK(maxExpense)}
          </SvgText>

          {/* Bars */}
          {data.map((d, idx) => {
            const x = PAD_LEFT + idx * (barW + gap);
            const iH = d.income > 0 ? (d.income / maxIncome) * incomeH : 0;
            const eH = d.expense > 0 ? (d.expense / maxExpense) * expenseH : 0;
            const isSelected = selected === idx;

            return (
              <React.Fragment key={idx}>
                {d.income > 0 && (
                  <Rect x={x} y={midY - iH} width={barW} height={iH}
                    fill={isSelected ? '#4ade80' : colors.green} rx={1}
                    opacity={isSelected ? 1 : 0.8} />
                )}
                {d.expense > 0 && (
                  <Rect x={x} y={midY} width={barW} height={eH}
                    fill={isSelected ? '#f87171' : colors.red} rx={1}
                    opacity={isSelected ? 1 : 0.8} />
                )}
              </React.Fragment>
            );
          })}

          {/* X-axis date labels */}
          {labelIndices.map(idx => (
            <SvgText key={idx} x={PAD_LEFT + idx * (barW + gap) + barW / 2} y={CHART_H - 4}
              fill={colors.textMuted} fontSize={10} fontWeight="500" textAnchor="middle">
              {data[idx].day}
            </SvgText>
          ))}

          {/* Selected line */}
          {selected !== null && (
            <Line x1={PAD_LEFT + selected * (barW + gap) + barW / 2} y1={PAD_TOP}
              x2={PAD_LEFT + selected * (barW + gap) + barW / 2} y2={PAD_TOP + h}
              stroke={colors.text} strokeWidth={0.5} strokeDasharray="3,3" opacity={0.3} />
          )}
        </Svg>
      </TouchableOpacity>

      {sel && (
        <Text style={st.selectedDate}>{sel.date}</Text>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  summaryLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '500' },
  summaryAmount: { fontSize: 13, fontWeight: '600', color: colors.text },
  netAmount: { fontSize: 14, fontWeight: '700' },
  selectedDate: { color: colors.textMuted, fontSize: 11, fontWeight: '500', textAlign: 'center', marginTop: 4 },
});
