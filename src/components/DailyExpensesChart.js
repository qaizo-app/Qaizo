// src/components/DailyExpensesChart.js
// Interactive daily expenses bar chart with tap-to-show amount per day
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import i18n from '../i18n';
import { sym } from '../utils/currency';

export default function DailyExpensesChart({ dailyExp, avgDaily, daysInMonth }) {
  const [selectedDay, setSelectedDay] = useState(null);
  const maxDaily = Math.max(...dailyExp, 1);
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animValue, { toValue: 1, duration: 600, useNativeDriver: false }).start();
  }, []);

  return (
    <View>
      {/* Tooltip for selected day */}
      {selectedDay !== null && dailyExp[selectedDay] > 0 && (
        <View style={st.tooltip}>
          <Text style={st.tooltipDay}>{selectedDay + 1}</Text>
          <Text style={st.tooltipAmount}>{dailyExp[selectedDay].toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()}</Text>
        </View>
      )}

      {/* Chart */}
      <View style={st.chart}>
        {dailyExp.map((val, idx) => {
          const isSelected = selectedDay === idx;
          const barH = Math.max((val / maxDaily) * 60, 1);
          const isHigh = val > avgDaily * 1.5;

          return (
            <TouchableOpacity
              key={idx}
              style={st.barWrap}
              onPress={() => setSelectedDay(selectedDay === idx ? null : idx)}
              activeOpacity={0.6}
            >
              <Animated.View style={[st.bar, {
                height: animValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, barH],
                }),
                backgroundColor: isSelected
                  ? colors.blue
                  : isHigh ? colors.red
                  : val > 0 ? colors.green
                  : colors.card,
                opacity: selectedDay !== null && !isSelected ? 0.35 : 1,
              }]} />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Labels */}
      <View style={st.labels}>
        <Text style={st.label}>1</Text>
        <Text style={st.label}>{Math.round(daysInMonth / 4)}</Text>
        <Text style={st.label}>{Math.round(daysInMonth / 2)}</Text>
        <Text style={st.label}>{Math.round(daysInMonth * 3 / 4)}</Text>
        <Text style={st.label}>{daysInMonth}</Text>
      </View>

      {/* Avg line label */}
      <View style={st.avgRow}>
        <View style={st.avgLine} />
        <Text style={st.avgLabel}>{avgDaily.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()}/d</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  tooltip: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.bg2, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12, marginBottom: 8, alignSelf: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  tooltipDay: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  tooltipAmount: { color: colors.text, fontSize: 14, fontWeight: '700' },

  chart: { flexDirection: i18n.row(), alignItems: 'flex-end', height: 64, gap: 1 },
  barWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 64 },
  bar: { width: '100%', borderRadius: 2, minHeight: 1 },

  labels: { flexDirection: i18n.row(), justifyContent: 'space-between', marginTop: 6 },
  label: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },

  avgRow: { flexDirection: i18n.row(), alignItems: 'center', marginTop: 8, gap: 8 },
  avgLine: { flex: 1, height: 1, backgroundColor: colors.textMuted, opacity: 0.3 },
  avgLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
});
