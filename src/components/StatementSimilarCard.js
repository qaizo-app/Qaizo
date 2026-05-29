// src/components/StatementSimilarCard.js
// One row in the "Similar to existing" section of the statement import flow:
// shows the extracted line on top, the existing candidate (or recurring
// template) below, and two action buttons. No default — the user must choose.
import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import { colors } from '../theme/colors';
import Amount from './Amount';
import RowText from './RowText';

export default function StatementSimilarCard({ extracted, candidate, isRecurring, onSame, onNew }) {
  const st = createSt();
  return (
    <View style={st.card}>
      {/* Extracted (top) */}
      <View style={st.row}>
        <Text style={st.dim}>{extracted.date}</Text>
        <RowText style={st.payee} numberOfLines={1}>{extracted.payee}</RowText>
        <Amount value={extracted.amount} sign style={st.amount} />
      </View>

      <View style={st.divider} />

      {/* Hint */}
      <View style={st.hintRow}>
        <Feather name={isRecurring ? 'repeat' : 'corner-down-left'} size={12} color={colors.textMuted} />
        <Text style={st.hint}>
          {isRecurring ? i18n.t('statementLooksLikeRecurring') : i18n.t('statementLooksLikeExisting')}
        </Text>
      </View>

      {/* Candidate (bottom) */}
      <View style={st.row}>
        <Text style={st.dim}>{isRecurring ? candidate.nextDate : (candidate.date || '').slice(0, 10)}</Text>
        <RowText style={st.payee} numberOfLines={1}>{candidate.recipient || '—'}</RowText>
        <Amount value={candidate.amount} sign style={st.amount} />
      </View>

      {/* Actions */}
      <View style={st.btnRow}>
        <TouchableOpacity style={[st.btn, st.btnSecondary]} onPress={onSame} activeOpacity={0.7}>
          <Text style={st.btnSecondaryTxt}>{i18n.t('statementBtnSameSkip')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[st.btn, st.btnPrimary]} onPress={onNew} activeOpacity={0.7}>
          <Text style={st.btnPrimaryTxt}>
            {isRecurring ? i18n.t('statementBtnConfirmRecurring') : i18n.t('statementBtnItIsNew')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createSt = () => StyleSheet.create({
  card: { backgroundColor: colors.bg2, borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.cardBorder },
  row: { flexDirection: i18n.row(), alignItems: 'center', gap: 8 },
  dim: { color: colors.textMuted, fontSize: 12, fontWeight: '600', minWidth: 64 },
  payee: { color: colors.text, fontSize: 14, fontWeight: '600', textAlign: i18n.textAlign() },
  amount: { fontSize: 14, fontWeight: '700' },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: 10 },
  hintRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 6, marginBottom: 8 },
  hint: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  btnRow: { flexDirection: i18n.row(), gap: 8, marginTop: 12 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  btnSecondary: { backgroundColor: 'transparent', borderColor: colors.cardBorder },
  btnSecondaryTxt: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  btnPrimary: { backgroundColor: colors.green, borderColor: colors.green },
  btnPrimaryTxt: { color: colors.bg, fontSize: 13, fontWeight: '700' },
});
