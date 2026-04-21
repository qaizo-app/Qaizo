// src/components/InteractiveBarChart.js
// Interactive bar chart for 6-month income/expense comparison
// Tap a bar → opens detail modal (labels above bars already allow quick comparison)
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import i18n from '../i18n';

function formatAmount(n) {
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

export default function InteractiveBarChart({ data, maxBar, onBarActivate }) {
  const animValues = useRef(data.map(() => new Animated.Value(0))).current;
  const st = createSt();

  useEffect(() => {
    const anims = animValues.map((val, idx) =>
      Animated.timing(val, { toValue: 1, duration: 400, delay: idx * 60, useNativeDriver: false })
    );
    Animated.stagger(60, anims).start();
  }, []);

  return (
    <View>
      <View style={st.chart}>
        {data.map((d, idx) => {
          const incH = Math.max((d.income / maxBar) * 100, 2);
          const expH = Math.max((d.expense / maxBar) * 100, 2);

          return (
            <TouchableOpacity
              key={idx}
              style={st.barGroup}
              onPress={() => onBarActivate && onBarActivate(d)}
              activeOpacity={0.7}
            >
              {(d.income > 0 || d.expense > 0) && (
                <View style={st.barLabels}>
                  {d.income > 0 && <Text style={[st.barAmount, { color: colors.green }]}>{formatAmount(d.income)}</Text>}
                  {d.expense > 0 && <Text style={[st.barAmount, { color: colors.red }]}>{formatAmount(d.expense)}</Text>}
                </View>
              )}

              <View style={st.barsWrap}>
                <Animated.View style={[st.bar, st.barIncome, {
                  height: animValues[idx].interpolate({ inputRange: [0, 1], outputRange: [2, incH] }),
                }]} />
                <Animated.View style={[st.bar, st.barExpense, {
                  height: animValues[idx].interpolate({ inputRange: [0, 1], outputRange: [2, expH] }),
                }]} />
              </View>
              <Text style={st.barLabel}>{d.month}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

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
  chart: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'flex-end', height: 140, paddingTop: 24 },
  barGroup: { flex: 1, alignItems: 'center', paddingVertical: 4, borderRadius: 8 },
  barLabels: { alignItems: 'center', marginBottom: 4, minHeight: 14 },
  barAmount: { fontSize: 10, fontWeight: '700' },
  barsWrap: { flexDirection: i18n.row(), alignItems: 'flex-end', gap: 3, marginBottom: 8 },
  bar: { width: 16, borderRadius: 4, minHeight: 2 },
  barIncome: { backgroundColor: colors.green },
  barExpense: { backgroundColor: colors.red },
  barLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '600', textAlign: 'center' },

  legend: { flexDirection: i18n.row(), justifyContent: 'center', gap: 20, marginTop: 12 },
  legendItem: { flexDirection: i18n.row(), alignItems: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginEnd: 6 },
  legendText: { color: colors.textDim, fontSize: 12, fontWeight: '500' },
});
