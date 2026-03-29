// src/components/StreakCard.js
// Карточка стрика на дашборде
import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import i18n from '../i18n';
import streakService from '../services/streakService';
import { colors } from '../theme/colors';
import Card from './Card';

function getStreakColor(streak) {
  if (streak >= 30) return colors.green;
  if (streak >= 14) return colors.teal;
  if (streak >= 7) return colors.yellow;
  if (streak >= 3) return colors.orange;
  return colors.textDim;
}

function getStreakIcon(streak) {
  if (streak >= 30) return 'award';
  if (streak >= 7) return 'zap';
  return 'zap';
}

export default function StreakCard({ streakData, transactions, weekStart = 'monday' }) {
  const st = createSt();
  if (!streakData) return null;

  const { currentStreak, longestStreak, underBudgetStreak } = streakData;
  const atRisk = streakService.isStreakAtRisk(streakData);
  const streakColor = getStreakColor(currentStreak);

  // 7 последних дней: есть транзакция или нет
  const activeDays = new Set();
  (transactions || []).forEach(tx => {
    activeDays.add(streakService.getLocalDate(tx.date || tx.createdAt));
  });

  // Метки дней по языку: index 0=Sunday, 1=Monday, ... 6=Saturday
  const allLabels = i18n.getLanguage() === 'he'
    ? ['א','ב','ג','ד','ה','ו','ש']  // Sun=א, Mon=ב, ... Sat=ש
    : i18n.getLanguage() === 'ru'
    ? ['Вс','Пн','Вт','Ср','Чт','Пт','Сб']
    : ['S','M','T','W','T','F','S'];

  // Начало текущей недели по настройке
  const wsMap = { sunday: 0, monday: 1, saturday: 6 };
  const wsIdx = wsMap[weekStart] ?? 1;
  const today = new Date();
  const todayDow = today.getDay(); // 0=Sun
  const diff = (todayDow - wsIdx + 7) % 7;
  const weekStartDate = new Date(today);
  weekStartDate.setDate(today.getDate() - diff);

  const last7 = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStartDate);
    d.setDate(weekStartDate.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    last7.push({ key, active: activeDays.has(key), label: allLabels[d.getDay()] });
  }

  // Если стрик 0 — показываем призыв начать
  if (currentStreak === 0 && !atRisk) {
    return (
      <Card>
        <View style={st.row}>
          <Feather name="zap" size={20} color={colors.textMuted} />
          <Text style={st.startText}>{i18n.t('startStreak')}</Text>
        </View>
      </Card>
    );
  }

  return (
    <Card highlighted={currentStreak >= 14}>
      <View style={st.topRow}>
        <View style={st.streakBadge}>
          <Feather name={getStreakIcon(currentStreak)} size={20} color={streakColor} />
          <Text style={[st.streakNum, { color: streakColor }]}>{currentStreak}</Text>
        </View>
        <Text style={st.streakLabel}>{i18n.t('dayStreak')}</Text>
      </View>

      {/* 7-дневная полоска */}
      <View style={st.dotsRow}>
        {last7.map((d, i) => (
          <View key={i} style={st.dotCol}>
            <Text style={st.dotLabel}>{d.label}</Text>
            <View style={[st.dot, d.active && { backgroundColor: streakColor }]} />
          </View>
        ))}
      </View>

      {/* Подвал */}
      <View style={st.bottomRow}>
        <Text style={st.statText}>
          {i18n.t('bestStreak')}: {longestStreak} {i18n.t('days')}
        </Text>
        {underBudgetStreak > 0 && (
          <Text style={st.statText}>
            {i18n.t('underBudget')}: {underBudgetStreak} {i18n.t('days')}
          </Text>
        )}
      </View>

      {/* Предупреждение */}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  startText: { color: colors.textMuted, fontSize: 14, fontWeight: '600', flex: 1, flexShrink: 1 },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  streakNum: { fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  streakLabel: { color: colors.textDim, fontSize: 15, fontWeight: '600' },

  dotsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  dotCol: { alignItems: 'center', gap: 6 },
  dotLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
  dot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.bg2, justifyContent: 'center', alignItems: 'center' },

  bottomRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statText: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },

  riskRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.divider },
  riskText: { color: colors.yellow, fontSize: 12, fontWeight: '600', flex: 1 },
});
