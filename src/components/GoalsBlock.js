// src/components/GoalsBlock.js
// Блок целей накоплений на дашборде (топ 3 цели)
import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Card from './Card';
import i18n from '../i18n';
import { colors } from '../theme/colors';

export default function GoalsBlock({ goals, expanded, onToggle }) {
  if (goals.length === 0) return null;
  return (
    <Card>
      <TouchableOpacity style={st.blockTitleRow} onPress={onToggle}>
        <Text style={st.blockTitle}>{i18n.t('goals')}</Text>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </TouchableOpacity>
      {expanded && goals.slice(0, 3).map(goal => {
        const saved = (goal.initialAmount || 0) + (goal.deposits || []).reduce((s, d) => s + d.amount, 0);
        const pct = goal.targetAmount > 0 ? Math.min(Math.round((saved / goal.targetAmount) * 100), 100) : 0;
        const gc = goal.color || '#34d399';
        return (
          <View key={goal.id} style={st.goalRow}>
            <View style={[st.goalDot, { backgroundColor: gc }]} />
            <View style={st.goalInfo}>
              <Text style={st.goalName} numberOfLines={1}>{goal.name}</Text>
              <View style={st.goalBar}>
                <View style={[st.goalBarFill, { width: `${pct}%`, backgroundColor: gc }]} />
              </View>
            </View>
            <Text style={[st.goalPct, { color: gc }]}>{pct}%</Text>
          </View>
        );
      })}
    </Card>
  );
}

const st = StyleSheet.create({
  blockTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 12, textAlign: i18n.textAlign() },
  blockTitleRow: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  goalDot: { width: 8, height: 8, borderRadius: 4 },
  goalInfo: { flex: 1 },
  goalName: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  goalBar: { height: 6, backgroundColor: colors.bg2, borderRadius: 3, overflow: 'hidden' },
  goalBarFill: { height: 6, borderRadius: 3 },
  goalPct: { fontSize: 12, fontWeight: '700', minWidth: 40, textAlign: 'right' },
});
