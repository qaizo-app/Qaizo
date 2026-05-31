// src/components/StatementSuggestRecurringCard.js
// Shown above the "New" section when the scanner notices a cluster of
// new rows that look like a missing recurring template (same payee, monthly
// or weekly cadence, stable amount). Tapping "Create template" flips the
// `accepted` flag — the actual addRecurring call happens during the final
// save in StatementScannerModal so the user can undo by tapping again.
import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import { colors } from '../theme/colors';
import Amount from './Amount';
import RowText from './RowText';

export default function StatementSuggestRecurringCard({ suggestion, accepted, onToggle }) {
  const st = createSt();
  const intervalLabel = suggestion.intervalKind === 'weekly'
    ? i18n.t('statementSuggestIntervalWeekly')
    : i18n.t('statementSuggestIntervalMonthly');
  const subtitle = i18n.t('statementSuggestSubtitle')
    .replace('{count}', String(suggestion.rowIndices.length))
    .replace('{interval}', intervalLabel);

  return (
    <View style={[st.card, accepted && st.cardAccepted]}>
      <View style={st.headRow}>
        <Feather name="repeat" size={16} color={accepted ? colors.green : colors.yellow} />
        <RowText style={st.payee} numberOfLines={1}>{suggestion.payee}</RowText>
        <Amount value={-suggestion.avgAmount} sign style={st.amount} color={colors.red} />
      </View>
      <Text style={st.subtitle}>{subtitle}</Text>
      <TouchableOpacity
        style={[st.btn, accepted ? st.btnAccepted : st.btnDefault]}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Feather name={accepted ? 'check' : 'plus'} size={14} color={accepted ? colors.bg : colors.green} />
        <Text style={[st.btnTxt, { color: accepted ? colors.bg : colors.green }]}>
          {accepted ? i18n.t('statementSuggestAccepted') : i18n.t('statementSuggestCreate')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const createSt = () => StyleSheet.create({
  card: {
    backgroundColor: colors.bg2,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cardAccepted: { borderColor: colors.green },
  headRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 8 },
  payee: { color: colors.text, fontSize: 14, fontWeight: '700', textAlign: i18n.textAlign() },
  amount: { fontSize: 14, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 6, marginBottom: 10, textAlign: i18n.textAlign() },
  btn: {
    flexDirection: i18n.row(),
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  btnDefault: { backgroundColor: 'transparent', borderColor: colors.green },
  btnAccepted: { backgroundColor: colors.green, borderColor: colors.green },
  btnTxt: { fontSize: 13, fontWeight: '700' },
});
