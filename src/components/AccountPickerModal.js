// src/components/AccountPickerModal.js
// Full-screen picker for choosing an account, grouped by account type.
// Replaces the horizontal-scrolling chip list in AddTransactionModal, which
// gets cumbersome once the user has more than a few accounts.
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import { accountTypeConfig, colors } from '../theme/colors';
import Amount from './Amount';
import RowText from './RowText';
import SwipeModal from './SwipeModal';

// Stable ordering of account-type groups (matches AccountsScreen).
const TYPE_ORDER = ['cash', 'bank', 'credit', 'investment', 'crypto', 'asset', 'loan', 'mortgage', 'debt'];

export default function AccountPickerModal({ visible, onClose, accounts = [], selectedId, onSelect, title }) {
  const st = createSt();

  // Group the (already-filtered) accounts by type, preserving TYPE_ORDER.
  const groups = useMemo(() => {
    const byType = {};
    accounts.forEach(a => {
      const t = a.type || 'bank';
      if (!byType[t]) byType[t] = [];
      byType[t].push(a);
    });
    return TYPE_ORDER.filter(t => byType[t]).map(t => ({ type: t, accs: byType[t] }));
  }, [accounts]);

  return (
    <SwipeModal visible={visible} onClose={onClose}>
      {({ close }) => (
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={st.title}>{title || i18n.t('account')}</Text>

          {groups.length === 0 ? (
            <Text style={st.empty}>{i18n.t('noAccounts') || '—'}</Text>
          ) : groups.map(({ type, accs }) => {
            const cfg = accountTypeConfig[type] || accountTypeConfig.bank;
            return (
              <View key={type} style={{ marginBottom: 12 }}>
                <View style={st.groupHeader}>
                  <MaterialCommunityIcons name={cfg.icon} size={14} color={cfg.color} />
                  <Text style={[st.groupTitle, { color: cfg.color }]}>{i18n.t(type)} · {accs.length}</Text>
                </View>
                {accs.map(acc => {
                  const sel = selectedId === acc.id;
                  return (
                    <TouchableOpacity
                      key={acc.id}
                      style={[st.row, sel && { borderColor: cfg.color, backgroundColor: cfg.color + '15' }]}
                      onPress={() => { onSelect && onSelect(acc.id); close(); }}
                      activeOpacity={0.7}
                    >
                      <RowText style={[st.rowName, sel && { color: cfg.color, fontWeight: '700' }]} numberOfLines={1}>
                        {acc.name}
                      </RowText>
                      <Amount value={acc.balance || 0} sign style={st.rowBal} currency={acc.currency} color={sel ? cfg.color : colors.textDim} />
                      {sel && <Feather name="check" size={16} color={cfg.color} style={{ marginStart: 8 }} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SwipeModal>
  );
}

// CLAUDE.md rule: i18n calls (textAlign / row) must NOT be at module level —
// they freeze at import time. Build styles inside the component instead.
const createSt = () => StyleSheet.create({
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 16, textAlign: i18n.textAlign() },
  groupHeader: { flexDirection: i18n.row(), alignItems: 'center', gap: 6, marginBottom: 8, paddingHorizontal: 4 },
  groupTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  row: { flexDirection: i18n.row(), alignItems: 'center', backgroundColor: colors.bg2, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14, marginBottom: 6, borderWidth: 1.5, borderColor: 'transparent' },
  rowName: { color: colors.text, fontSize: 15, fontWeight: '600', textAlign: i18n.textAlign() },
  rowBal: { fontSize: 13, fontWeight: '700' },
  empty: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 24 },
});
