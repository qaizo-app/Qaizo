// src/components/StreakCard.js
// Compact streak widget: fire + number + progress bar + "today" status
import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import i18n from '../i18n';
import streakService from '../services/streakService';
import { colors } from '../theme/colors';
import Card from './Card';

const LEVELS = [
  { min: 0,   key: 'streakStart',   color: colors.textMuted },
  { min: 3,   key: 'streakBeginner', color: colors.orange },
  { min: 7,   key: 'streakRegular',  color: colors.yellow },
  { min: 14,  key: 'streakPro',      color: '#22d3ee' },
  { min: 30,  key: 'streakMaster',   color: colors.green },
  { min: 100, key: 'streakLegend',   color: '#fbbf24' },
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

  const { currentStreak } = streakData;

  // Streak = 0 — don't show card at all
  if (currentStreak === 0) return null;

  const level = getLevel(currentStreak);
  const nextLevel = getNextLevel(currentStreak);

  // Check if user logged a transaction today
  const todayKey = streakService.getLocalDate(new Date().toISOString());
  const todayLogged = (transactions || []).some(tx =>
    streakService.getLocalDate(tx.date || tx.createdAt) === todayKey
  );

  // Progress to next level
  const progressPct = nextLevel
    ? Math.min(100, Math.round(((currentStreak - level.min) / (nextLevel.min - level.min)) * 100))
    : 100;
  const daysLeft = nextLevel ? nextLevel.min - currentStreak : 0;

  return (
    <Card>
      {/* Row 1: Fire icon + streak number + level name */}
      <View style={st.topRow}>
        <Text style={st.fire}>🔥</Text>
        <Text style={[st.streakNum, { color: level.color }]}>{currentStreak}</Text>
        <Text style={st.streakLabel}>{i18n.t('dayStreak')}</Text>
        <View style={{ flex: 1 }} />
        <Text style={[st.levelBadge, { color: level.color, backgroundColor: level.color + '15' }]}>
          {i18n.t(level.key)}
        </Text>
      </View>

      {/* Row 2: Progress bar to next level */}
      {nextLevel && (
        <View style={st.progressSection}>
          <View style={st.progressBar}>
            <View style={[st.progressFill, { width: `${progressPct}%`, backgroundColor: level.color }]} />
          </View>
          <Text style={st.progressText}>
            {daysLeft} {i18n.t('daysTo')} {i18n.t(nextLevel.key)}
          </Text>
        </View>
      )}

      {/* Row 3: Today status */}
      {!todayLogged && (
        <View style={st.todayRow}>
          <Feather name="alert-circle" size={14} color={colors.yellow} />
          <Text style={st.todayText}>{i18n.t('streakTodayNotLogged')}</Text>
        </View>
      )}
    </Card>
  );
}

const createSt = () => StyleSheet.create({
  // Top row
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    direction: 'ltr',
  },
  fire: {
    fontSize: 22,
  },
  streakNum: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -1,
  },
  streakLabel: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '500',
  },
  levelBadge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },

  // Progress
  progressSection: {
    marginTop: 12,
    direction: 'ltr',
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.bg2,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  progressText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 6,
  },

  // Today warning
  todayRow: {
    flexDirection: i18n.row(),
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  todayText: {
    color: colors.yellow,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
});
