// src/components/DashboardLayoutModal.js
// Modal to reorder and toggle visibility of dashboard blocks
import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import i18n from '../i18n';
import { colors } from '../theme/colors';

const BLOCK_ICONS = {
  balance: 'dollar-sign',
  streak: 'zap',
  freeMoneyToday: 'sun',
  pieChart: 'pie-chart',
  budgets: 'target',
  recurring: 'repeat',
  barChart: 'bar-chart-2',
  recentTx: 'list',
};

export const DEFAULT_LAYOUT = [
  { id: 'balance', visible: true },
  { id: 'streak', visible: true },
  { id: 'freeMoneyToday', visible: true },
  { id: 'pieChart', visible: true },
  { id: 'budgets', visible: true },
  { id: 'recurring', visible: true },
  { id: 'barChart', visible: true },
  { id: 'recentTx', visible: true },
];

export default function DashboardLayoutModal({ visible, onClose, layout, onSave }) {
  const [blocks, setBlocks] = useState(layout || DEFAULT_LAYOUT);
  const st = createSt();

  const blockLabel = (id) => i18n.t(`block${id.charAt(0).toUpperCase() + id.slice(1)}`) || id;

  const toggleBlock = (idx) => {
    const next = [...blocks];
    next[idx] = { ...next[idx], visible: !next[idx].visible };
    setBlocks(next);
  };

  const moveUp = (idx) => {
    if (idx === 0) return;
    const next = [...blocks];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setBlocks(next);
  };

  const moveDown = (idx) => {
    if (idx === blocks.length - 1) return;
    const next = [...blocks];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setBlocks(next);
  };

  const handleSave = () => {
    onSave(blocks);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.overlay}>
        <View style={st.modal}>
          <Text style={st.title}>{i18n.t('dashboardLayout')}</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
            {blocks.map((block, idx) => (
              <View key={block.id} style={[st.row, !block.visible && st.rowDim]}>
                {/* Toggle */}
                <TouchableOpacity style={st.toggle} onPress={() => toggleBlock(idx)}>
                  <Feather name={block.visible ? 'eye' : 'eye-off'} size={16}
                    color={block.visible ? colors.green : colors.textMuted} />
                </TouchableOpacity>

                {/* Icon + Label */}
                <Feather name={BLOCK_ICONS[block.id] || 'square'} size={16}
                  color={block.visible ? colors.text : colors.textMuted} style={{ marginEnd: 10 }} />
                <Text style={[st.label, !block.visible && st.labelDim]} numberOfLines={1}>
                  {blockLabel(block.id)}
                </Text>

                {/* Move buttons */}
                <TouchableOpacity style={st.moveBtn} onPress={() => moveUp(idx)} disabled={idx === 0}>
                  <Feather name="chevron-up" size={18} color={idx === 0 ? colors.divider : colors.textDim} />
                </TouchableOpacity>
                <TouchableOpacity style={st.moveBtn} onPress={() => moveDown(idx)} disabled={idx === blocks.length - 1}>
                  <Feather name="chevron-down" size={18} color={idx === blocks.length - 1 ? colors.divider : colors.textDim} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <View style={st.footer}>
            <TouchableOpacity style={st.cancelBtn} onPress={onClose}>
              <Text style={st.cancelTxt}>{i18n.t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.saveBtn} onPress={handleSave}>
              <Feather name="check" size={16} color="#fff" />
              <Text style={st.saveTxt}>{i18n.t('save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createSt = () => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: 24 },
  modal: { backgroundColor: colors.bg2, borderRadius: 20, padding: 20, width: '100%', borderWidth: 1, borderColor: colors.cardBorder },
  title: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },

  row: { flexDirection: i18n.row(), alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: colors.cardBorder },
  rowDim: { opacity: 0.5 },
  toggle: { marginEnd: 10 },
  label: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  labelDim: { color: colors.textMuted },
  moveBtn: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  footer: { flexDirection: i18n.row(), gap: 10, marginTop: 14 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.card, alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  cancelTxt: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  saveBtn: { flex: 2, flexDirection: i18n.row(), paddingVertical: 14, borderRadius: 12, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', gap: 6 },
  saveTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
