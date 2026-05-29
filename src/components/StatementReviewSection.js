// src/components/StatementReviewSection.js
// Collapsible group header for one of the three review sections
// (New / Similar / Already-in-account). Renders its children only when open.
import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import { colors } from '../theme/colors';
import RowText from './RowText';

export default function StatementReviewSection({ title, count, accent, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const st = createSt();
  return (
    <View style={st.wrap}>
      <TouchableOpacity style={st.header} onPress={() => setOpen(o => !o)} activeOpacity={0.7}>
        <View style={[st.dot, { backgroundColor: accent || colors.textMuted }]} />
        <RowText style={[st.title, { color: accent || colors.text }]}>{title}</RowText>
        <Text style={st.count}>{count}</Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </TouchableOpacity>
      {open && <View style={st.body}>{children}</View>}
    </View>
  );
}

const createSt = () => StyleSheet.create({
  wrap: { marginBottom: 14 },
  header: { flexDirection: i18n.row(), alignItems: 'center', gap: 8, paddingVertical: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', textAlign: i18n.textAlign() },
  count: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  body: { },
});
