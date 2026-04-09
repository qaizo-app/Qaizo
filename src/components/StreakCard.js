// src/components/StreakCard.js
// Streak card with mini calendar (30 days), levels, stats
import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import i18n from '../i18n';
import streakService from '../services/streakService';
import { colors } from '../theme/colors';
import Card from './Card';

const LEVELS = [
  { min: 0,  key: 'streakStart',   icon: 'zap',    color: colors.textMuted },
  { min: 3,  key: 'streakBeginner', icon: 'zap',    color: colors.orange },
  { min: 7,  key: 'streakRegular',  icon: 'zap',    color: colors.yellow },
  { min: 14, key: 'streakPro',      icon: 'award',  color: '#22d3ee' },
  { min: 30, key: 'streakMaster',   icon: 'award',  color: colors.green },
  { min: 100,key: 'streakLegend',   icon: 'star',   color: '#fbbf24' },
];

function getLevel(streak) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (streak >= LEVELS[i].min) return LEVELS[i];
  }
  return LEVELS[0];
}

function getNextLevel(streak) {
  for (const lvl of LEVELS) {
    if (streak < lvl.min) return lvl;
  }
  return null;
}

export default function StreakCard({ streakData, transactions }) {
  const st = createSt();
  if (!streakData) return null;

  const { currentStreak, longestStreak, underBudgetStreak } = streakData;
  const atRisk = streakService.isStreakAtRisk(streakData);
  const level = getLevel(currentStreak);
  const nextLevel = getNextLevel(currentStreak);

  // Build 30-day calendar
  const activeDays = new Set();
  (transactions || []).forEach(tx => {
    activeDays.add(streakService.getLocalDate(tx.date || tx.createdAt));
  });

  const today = new Date();
  const calendar = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const isToday = i === 0;
    calendar.push({ key, active: activeDays.has(key), isToday });
  }

  // Streak = 0 — show call to action
  if (currentStreak === 0 && !atRisk) {
    return (
      <Card>
        <View style={st.startRow}>
          <View style={[st.startIcon, { backgroundColor: colors.bg2 }]}>
            <Feather name="zap" size={22} color={colors.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.startTitle}>{i18n.t('startStreak')}</Text>
            <Text style={st.startSub}>{i18n.t('startStreakSub')}</Text>
          </View>
        </View>
      </Card>
    );
  }

  // Progress to next level
  const progressPct = nextLevel
    ? Math.round(((currentStreak - level.min) / (nextLevel.min - level.min)) * 100)
    : 100;

  return (
    <Card highlighted={currentStreak >= 14}>
      {/* Top: streak number + level */}
      <View style={st.topRow}>
        <View style={[st.levelIcon, { backgroundColor: level.color + '18' }]}>
          <Feather name={level.icon} size={22} color={level.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={st.streakRow}>
            <Text style={[st.streakNum, { color: level.color }]}>{currentStreak}</Text>
            <Text style={st.streakLabel}>{i18n.t('dayStreak')}</Text>
          </View>
          <Text style={[st.levelName, { color: level.color }]}>{i18n.t(level.key)}</Text>
        </View>
        {/* At risk warning */}
        {atRisk && (
          <View style={st.riskBadge}>
            <Feather name="alert-circle" size={14} color={colors.yellow} />
          </View>
        )}
      </View>

      {/* Progress to next level */}
      {nextLevel && (
        <View style={st.progressWrap}>
          <View style={st.progressBar}>
            <View style={[st.progressFill, { width: `${progressPct}%`, backgroundColor: level.color }]} />
          </View>
          <Text style={st.progressText}>
            {nextLevel.min - currentStreak} {i18n.t('daysTo')} {i18n.t(nextLevel.key)}
          </Text>
        </View>
      )}

      {/* 30-day mini calendar */}
      <View style={st.calendar}>
        {calendar.map((d, i) => (
          <View key={i} style={[
            st.calDay,
            d.active && { backgroundColor: level.color },
            d.isToday && !d.active && st.calToday,
          ]} />
        ))}
      </View>

      {/* Stats row */}
      <View style={st.statsRow}>
        <View style={st.stat}>
          <Text style={st.statNum}>{longestStreak}</Text>
          <Text style={st.statLabel}>{i18n.t('bestStreak')}</Text>
        </View>
        {underBudgetStreak > 0 && (
          <View style={st.stat}>
            <Text style={[st.statNum, { color: colors.green }]}>{underBudgetStreak}</Text>
            <Text style={st.statLabel}>{i18n.t('underBudget')}</Text>
          </View>
        )}
        <View style={st.stat}>
          <Text style={st.statNum}>{calendar.filter(d => d.active).length}</Text>
          <Text style={st.statLabel}>{i18n.t('last30days')}</Text>
        </View>
      </View>

      {/* At risk message */}
      {atRisk && (
        <View style={st.riskRow}>
          <Feather name="alert-circle" size={14} color={colors.yellow} />
          <Text style={st.riskText}>{i18n.t('streakAtRisk')}</Text>
        </View>
      )}
    </Card>
  );
}

const createSt = () => StyleSheet.create({
  // Start state
  startRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  startIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  startTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  startSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

  // Top
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  levelIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  streakRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  streakNum: { fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  streakLabel: { color: colors.textDim, fontSize: 14, fontWeight: '500' },
  levelName: { fontSize: 12, fontWeight: '700', marginTop: 1 },
  riskBadge: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.yellow + '15', justifyContent: 'center', alignItems: 'center' },

  // Progress
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  progressBar: { flex: 1, height: 4, backgroundColor: colors.bg2, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  progressText: { color: colors.textMuted, fontSize: 10, fontWeight: '600', minWidth: 60 },

  // Calendar
  calendar: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginBottom: 14, direction: 'ltr' },
  calDay: { width: 14, height: 14, borderRadius: 3, backgroundColor: colors.bg2 },
  calToday: { borderWidth: 1, borderColor: colors.textMuted },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: colors.bg2, borderRadius: 10, padding: 10, alignItems: 'center' },
  statNum: { color: colors.text, fontSize: 16, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '500', marginTop: 2 },

  // Risk
  riskRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.divider },
  riskText: { color: colors.yellow, fontSize: 12, fontWeight: '600', flex: 1 },
});
