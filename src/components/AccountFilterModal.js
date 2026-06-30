// src/components/AccountFilterModal.js
// Multi-select account filter for the Analytics screen. Type-preset chips
// (All / Credit / Investment / …) for quick group selection, plus a per-account
// checkbox list grouped by type for precise picks (e.g. 3 of 9 credit cards).
// Edits a local draft; "Apply" commits it. Empty / full selection means "all".
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import { accountTypeConfig, colors } from '../theme/colors';
import Amount from './Amount';
import RowText from './RowText';
import SwipeModal from './SwipeModal';

// Stable ordering of account-type groups (matches AccountPickerModal).
const TYPE_ORDER = ['cash', 'bank', 'credit', 'investment', 'crypto', 'asset', 'loan', 'mortgage', 'debt'];

export default function AccountFilterModal({ visible, onClose, accounts = [], selectedIds = [], onApply }) {
  const st = createSt();
  const [draft, setDraft] = useState([]);

  // Seed the draft from the committed selection on each open. An empty committed
  // selection means "all", so reflect that as every account checked.
  useEffect(() => {
    if (visible) {
      setDraft(selectedIds && selectedIds.length > 0 ? [...selectedIds] : accounts.map(a => a.id));
    }
  }, [visible]);

  const groups = useMemo(() => {
    const byType = {};
    accounts.forEach(a => {
      const t = a.type || 'bank';
      if (!byType[t]) byType[t] = [];
      byType[t].push(a);
    });
    return TYPE_ORDER.filter(t => byType[t]).map(t => ({ type: t, accs: byType[t] }));
  }, [accounts]);

  const draftSet = new Set(draft);
  const isAll = accounts.length > 0 && draft.length === accounts.length;

  const toggle = (id) => setDraft(d => (d.includes(id) ? d.filter(x => x !== id) : [...d, id]));
  const selectAll = () => setDraft(accounts.map(a => a.id));
  const selectType = (type) => setDraft(accounts.filter(a => (a.type || 'bank') === type).map(a => a.id));
  const typeFullySelected = (type) => {
    const ids = accounts.filter(a => (a.type || 'bank') === type).map(a => a.id);
    return ids.length > 0 && ids.every(id => draftSet.has(id));
  };

  const apply = (close) => {
    // Represent "all" (full or empty) as [] so AnalyticsScreen's isAll stays simple.
    onApply(draft.length === 0 || draft.length === accounts.length ? [] : draft);
    close();
  };

  return (
    <SwipeModal
      visible={visible}
      onClose={onClose}
      footer={({ close }) => (
        <TouchableOpacity style={st.applyBtn} onPress={() => apply(close)} activeOpacity={0.85}>
          <Feather name="check" size={18} color={colors.bg} />
          <Text style={st.applyTxt}>{i18n.t('apply')}</Text>
        </TouchableOpacity>
      )}
    >
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={st.title}>{i18n.t('filterAccounts')}</Text>

        {/* Type presets */}
        <View style={st.presetRow}>
          <TouchableOpacity style={[st.preset, isAll && st.presetActive]} onPress={selectAll} activeOpacity={0.7}>
            <Text style={[st.presetTxt, isAll && st.presetTxtActive]}>{i18n.t('allAccounts')}</Text>
          </TouchableOpacity>
          {groups.map(({ type }) => {
            const cfg = accountTypeConfig[type] || accountTypeConfig.bank;
            const on = !isAll && typeFullySelected(type);
            return (
              <TouchableOpacity key={type}
                style={[st.preset, on && { borderColor: cfg.color, backgroundColor: cfg.color + '15' }]}
                onPress={() => selectType(type)} activeOpacity={0.7}>
                <MaterialCommunityIcons name={cfg.icon} size={13} color={on ? cfg.color : colors.textMuted} />
                <Text style={[st.presetTxt, on && { color: cfg.color }]}>{i18n.t(type)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Per-account checkboxes, grouped by type */}
        {groups.map(({ type, accs }) => {
          const cfg = accountTypeConfig[type] || accountTypeConfig.bank;
          return (
            <View key={type} style={{ marginBottom: 12 }}>
              <View style={st.groupHeader}>
                <MaterialCommunityIcons name={cfg.icon} size={14} color={cfg.color} />
                <Text style={[st.groupTitle, { color: cfg.color }]}>{i18n.t(type)} · {accs.length}</Text>
              </View>
              {accs.map(acc => {
                const on = draftSet.has(acc.id);
                return (
                  <TouchableOpacity key={acc.id}
                    style={[st.row, on && { borderColor: cfg.color, backgroundColor: cfg.color + '12' }]}
                    onPress={() => toggle(acc.id)} activeOpacity={0.7}>
                    <Feather name={on ? 'check-square' : 'square'} size={18} color={on ? cfg.color : colors.textMuted} />
                    <RowText style={[st.rowName, on && { color: cfg.color, fontWeight: '700' }]} numberOfLines={1}>
                      {acc.name}
                    </RowText>
                    <Amount value={acc.balance || 0} sign style={st.rowBal} currency={acc.currency} color={colors.textDim} />
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
    </SwipeModal>
  );
}

const createSt = () => StyleSheet.create({
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 16, textAlign: i18n.textAlign() },
  presetRow: { flexDirection: i18n.row(), flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  preset: { flexDirection: i18n.row(), alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1.5, borderColor: 'transparent' },
  presetActive: { borderColor: colors.green, backgroundColor: colors.green + '15' },
  presetTxt: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  presetTxtActive: { color: colors.green },
  groupHeader: { flexDirection: i18n.row(), alignItems: 'center', gap: 6, marginBottom: 8, paddingHorizontal: 4 },
  groupTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  row: { flexDirection: i18n.row(), alignItems: 'center', gap: 12, backgroundColor: colors.bg2, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14, marginBottom: 6, borderWidth: 1.5, borderColor: 'transparent' },
  rowName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600', textAlign: i18n.textAlign() },
  rowBal: { fontSize: 13, fontWeight: '700' },
  applyBtn: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.green, borderRadius: 14, paddingVertical: 15 },
  applyTxt: { color: colors.bg, fontSize: 15, fontWeight: '700' },
});
