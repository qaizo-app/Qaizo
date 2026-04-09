// src/components/ColorPickerRow.js
// Row of quick colors + expand button for full palette with gradients
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import i18n from '../i18n';
import { colors } from '../theme/colors';

const QUICK_COLORS = [
  '#fb7185', '#f97316', '#f59e0b', '#34d399', '#22d3ee', '#60a5fa', '#a78bfa',
];

const ALL_COLORS = [
  // Reds
  '#fca5a5', '#fb7185', '#f87171', '#ef4444', '#dc2626', '#b91c1c',
  // Oranges
  '#fdba74', '#f97316', '#ea580c', '#c2410c',
  // Yellows
  '#fde047', '#fbbf24', '#f59e0b', '#d97706',
  // Greens
  '#86efac', '#4ade80', '#34d399', '#22c55e', '#16a34a', '#15803d',
  // Teals
  '#5eead4', '#2dd4bf', '#14b8a6', '#0d9488',
  // Blues
  '#7dd3fc', '#38bdf8', '#22d3ee', '#06b6d4', '#60a5fa', '#3b82f6', '#2563eb',
  // Purples
  '#c4b5fd', '#a78bfa', '#818cf8', '#8b5cf6', '#7c3aed', '#6d28d9',
  // Pinks
  '#f9a8d4', '#f472b6', '#ec4899', '#db2777', '#be185d',
  // Neutrals
  '#94a3b8', '#64748b', '#475569', '#334155',
];

const GRADIENTS = [
  ['#f97316', '#ef4444'],
  ['#fbbf24', '#f59e0b'],
  ['#34d399', '#06b6d4'],
  ['#60a5fa', '#818cf8'],
  ['#a78bfa', '#ec4899'],
  ['#f472b6', '#fb7185'],
  ['#22c55e', '#16a34a'],
  ['#3b82f6', '#2563eb'],
  ['#8b5cf6', '#6d28d9'],
  ['#ec4899', '#be185d'],
  ['#06b6d4', '#0d9488'],
  ['#f97316', '#fbbf24'],
];

export default function ColorPickerRow({ selected, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const st = createSt();

  return (
    <>
      <View style={st.row}>
        {QUICK_COLORS.map(c => (
          <TouchableOpacity key={c}
            style={[st.dot, { backgroundColor: c }, selected === c && st.dotActive]}
            onPress={() => onSelect(c)} />
        ))}
        <TouchableOpacity style={st.expandBtn} onPress={() => setExpanded(true)}>
          <Feather name="plus" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <Modal visible={expanded} transparent animationType="slide">
        <View style={st.modalOverlay}>
          <TouchableOpacity style={st.modalBg} activeOpacity={1} onPress={() => setExpanded(false)} />
          <View style={st.modalContainer}>
            <View style={st.modalHandle} />
            <Text style={st.modalTitle}>{i18n.t('color')}</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              {/* Solid colors */}
              <View style={st.grid}>
                {ALL_COLORS.map(c => (
                  <TouchableOpacity key={c}
                    style={[st.colorBtn, { backgroundColor: c }, selected === c && st.colorBtnActive]}
                    onPress={() => { onSelect(c); setExpanded(false); }} />
                ))}
              </View>

              {/* Gradients */}
              <Text style={st.sectionLabel}>{i18n.t('gradients') || 'Gradients'}</Text>
              <View style={st.grid}>
                {GRADIENTS.map((g, idx) => (
                  <TouchableOpacity key={`grad-${idx}`}
                    style={[st.colorBtn, selected === g[0] && st.colorBtnActive]}
                    onPress={() => { onSelect(g[0]); setExpanded(false); }}>
                    <View style={{ flex: 1, flexDirection: 'row', borderRadius: 14, overflow: 'hidden' }}>
                      <View style={{ flex: 1, backgroundColor: g[0] }} />
                      <View style={{ flex: 1, backgroundColor: g[1] }} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const createSt = () => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  dot: { width: 32, height: 32, borderRadius: 16 },
  dotActive: { borderWidth: 3, borderColor: colors.text },
  expandBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, justifyContent: 'center', alignItems: 'center' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContainer: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.divider, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  sectionLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 16, marginBottom: 10 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  colorBtn: { width: 36, height: 36, borderRadius: 14, overflow: 'hidden' },
  colorBtnActive: { borderWidth: 3, borderColor: colors.text },
});
