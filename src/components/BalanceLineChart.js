// src/components/BalanceLineChart.js
// SVG line chart showing balance over time with Y-axis labels
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop, Circle, Line, Text as SvgText } from 'react-native-svg';
import Amount from './Amount';
import { colors } from '../theme/colors';

const CHART_H = 170;
const PAD_LEFT = 50;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOT = 24;

function formatK(n) {
  const abs = Math.abs(n);
  if (abs >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

export default function BalanceLineChart({ data }) {
  const [containerW, setContainerW] = useState(300);
  const [selected, setSelected] = useState(null);

  if (!data || data.length < 2) return null;

  const w = containerW - PAD_LEFT - PAD_RIGHT;
  const h = CHART_H - PAD_TOP - PAD_BOT;

  const values = data.map(d => d.balance);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const getX = (i) => PAD_LEFT + (i / (data.length - 1)) * w;
  const getY = (val) => PAD_TOP + h - ((val - minVal) / range) * h;

  // Build SVG path
  let pathD = `M ${getX(0)} ${getY(values[0])}`;
  for (let i = 1; i < data.length; i++) {
    pathD += ` L ${getX(i)} ${getY(values[i])}`;
  }

  // Area fill
  const areaD = pathD + ` L ${getX(data.length - 1)} ${PAD_TOP + h} L ${getX(0)} ${PAD_TOP + h} Z`;

  // X-axis labels (dates)
  const labelCount = Math.min(4, data.length - 1);
  const labelIndices = [];
  for (let i = 0; i <= labelCount; i++) {
    labelIndices.push(Math.round((i / labelCount) * (data.length - 1)));
  }

  // Y-axis: 3 lines (max, mid, min)
  const midVal = (maxVal + minVal) / 2;
  const yLabels = [
    { val: maxVal, y: getY(maxVal) },
    { val: midVal, y: getY(midVal) },
    { val: minVal, y: getY(minVal) },
  ];

  const handlePress = (evt) => {
    const x = evt.nativeEvent.locationX - PAD_LEFT;
    const idx = Math.round((x / w) * (data.length - 1));
    if (idx >= 0 && idx < data.length) setSelected(idx);
  };

  const selectedPoint = selected !== null ? data[selected] : null;
  const startVal = values[0];
  const endVal = values[values.length - 1];
  const change = startVal !== 0 ? Math.round(((endVal - startVal) / Math.abs(startVal)) * 100) : 0;
  const isPositive = endVal >= startVal;

  return (
    <View>
      {/* Header */}
      <View style={st.headerRow}>
        <Amount value={selectedPoint ? selectedPoint.balance : endVal} style={st.headerAmount} />
        {!selectedPoint && change !== 0 && (
          <View style={[st.changeBadge, { backgroundColor: isPositive ? colors.greenSoft : colors.redSoft }]}>
            <Text style={[st.changeText, { color: isPositive ? colors.green : colors.red }]}>
              {change > 0 ? '+' : ''}{change}%
            </Text>
          </View>
        )}
        {selectedPoint && (
          <Text style={st.selectedDate}>{selectedPoint.date}</Text>
        )}
      </View>

      <TouchableOpacity activeOpacity={1} onPress={handlePress}
        onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}>
        <Svg width={containerW} height={CHART_H}>
          <Defs>
            <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={isPositive ? colors.green : colors.red} stopOpacity="0.2" />
              <Stop offset="1" stopColor={isPositive ? colors.green : colors.red} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>

          {/* Y-axis grid lines + labels */}
          {yLabels.map((yl, idx) => (
            <React.Fragment key={idx}>
              <Line x1={PAD_LEFT} y1={yl.y} x2={containerW - PAD_RIGHT} y2={yl.y}
                stroke={colors.divider} strokeWidth={0.5} strokeDasharray="4,4" />
              <SvgText x={PAD_LEFT - 6} y={yl.y + 4}
                fill={colors.textMuted} fontSize={10} fontWeight="500" textAnchor="end">
                {formatK(yl.val)}
              </SvgText>
            </React.Fragment>
          ))}

          {/* Area fill */}
          <Path d={areaD} fill="url(#areaGrad)" />

          {/* Line */}
          <Path d={pathD} fill="none" stroke={isPositive ? colors.green : colors.red}
            strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {/* Zero line */}
          {minVal < 0 && maxVal > 0 && (
            <Line x1={PAD_LEFT} y1={getY(0)} x2={containerW - PAD_RIGHT} y2={getY(0)}
              stroke={colors.textMuted} strokeWidth={1} strokeDasharray="4,4" />
          )}

          {/* Selected dot */}
          {selected !== null && (
            <>
              <Line x1={getX(selected)} y1={PAD_TOP} x2={getX(selected)} y2={PAD_TOP + h}
                stroke={colors.textMuted} strokeWidth={0.5} strokeDasharray="3,3" />
              <Circle cx={getX(selected)} cy={getY(values[selected])} r={5}
                fill={isPositive ? colors.green : colors.red} stroke={colors.card} strokeWidth={2} />
            </>
          )}

          {/* X-axis date labels */}
          {labelIndices.map(idx => (
            <SvgText key={idx} x={getX(idx)} y={CHART_H - 4}
              fill={colors.textMuted} fontSize={10} fontWeight="500" textAnchor="middle">
              {data[idx].day}
            </SvgText>
          ))}
        </Svg>
      </TouchableOpacity>
    </View>
  );
}

// Need React for Fragment
import React from 'react';

const st = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  headerAmount: { fontSize: 20, fontWeight: '700', color: colors.text },
  changeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  changeText: { fontSize: 13, fontWeight: '700' },
  selectedDate: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
});
