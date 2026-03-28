// src/components/ExportModal.js
// Модалка экспорта — выбор формата + диапазон дат
import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import exportService from '../services/exportService';
import { colors } from '../theme/colors';

const PERIODS = [
  { key: 'thisMonth', label: () => i18n.t('thisMonth') },
  { key: 'lastMonth', label: () => i18n.t('lastMonth') },
  { key: 'last3', label: () => i18n.t('last3Months') },
  { key: 'thisYear', label: () => i18n.t('thisYear') },
  { key: 'all', label: () => i18n.t('allTime') },
];

function getDateRange(key) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (key) {
    case 'thisMonth':
      return { from: `${y}-${String(m + 1).padStart(2, '0')}-01`, to: null };
    case 'lastMonth': {
      const pm = m === 0 ? 11 : m - 1;
      const py = m === 0 ? y - 1 : y;
      const lastDay = new Date(py, pm + 1, 0).getDate();
      return { from: `${py}-${String(pm + 1).padStart(2, '0')}-01`, to: `${py}-${String(pm + 1).padStart(2, '0')}-${lastDay}` };
    }
    case 'last3': {
      const d = new Date(y, m - 2, 1);
      return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, to: null };
    }
    case 'thisYear':
      return { from: `${y}-01-01`, to: null };
    case 'all':
    default:
      return { from: null, to: null };
  }
}

export default function ExportModal({ visible, onClose, onResult }) {
  const [period, setPeriod] = useState('thisMonth');
  const [loading, setLoading] = useState(false);
  const st = createSt();

  const handleExport = async (format) => {
    setLoading(true);
    try {
      const { from, to } = getDateRange(period);
      if (format === 'csv') await exportService.exportCSV(from, to);
      else if (format === 'xls') await exportService.exportXLS(from, to);
      else if (format === 'pdf') await exportService.exportPDF(from, to);
      onResult?.('success');
    } catch (e) {
      console.error('Export error:', e);
      if (e.message === 'NO_DATA') onResult?.('noData');
      else onResult?.('error');
    }
    setLoading(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={st.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={st.sheet} activeOpacity={1}>
          <Text style={st.title}>{i18n.t('exportData')}</Text>

          {/* Период */}
          <Text style={st.label}>{i18n.t('period')}</Text>
          <View style={st.periods}>
            {PERIODS.map(p => (
              <TouchableOpacity key={p.key}
                style={[st.periodBtn, period === p.key && st.periodBtnActive]}
                onPress={() => setPeriod(p.key)}>
                <Text style={[st.periodTxt, period === p.key && st.periodTxtActive]}>
                  {p.label()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Форматы */}
          <Text style={st.label}>{i18n.t('format')}</Text>
          <View style={st.formats}>
            <TouchableOpacity style={st.fmtBtn} onPress={() => handleExport('csv')} disabled={loading}>
              <Feather name="file-text" size={22} color={colors.green} />
              <Text style={st.fmtTxt}>CSV</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.fmtBtn} onPress={() => handleExport('xls')} disabled={loading}>
              <Feather name="grid" size={22} color={colors.teal} />
              <Text style={st.fmtTxt}>Excel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.fmtBtn} onPress={() => handleExport('pdf')} disabled={loading}>
              <Feather name="file" size={22} color={colors.red} />
              <Text style={st.fmtTxt}>PDF</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={st.cancelBtn} onPress={onClose}>
            <Text style={st.cancelTxt}>{i18n.t('cancel')}</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const createSt = () => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },

  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
  label: { color: colors.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10, marginTop: 8 },

  periods: { flexDirection: i18n.row(), flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  periodBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.bg2, borderWidth: 1, borderColor: 'transparent' },
  periodBtnActive: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  periodTxt: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  periodTxtActive: { color: colors.green },

  formats: { flexDirection: i18n.row(), gap: 12, marginBottom: 20 },
  fmtBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 20, borderRadius: 16, backgroundColor: colors.bg2, gap: 8 },
  fmtTxt: { color: colors.text, fontSize: 14, fontWeight: '700' },

  cancelBtn: { alignItems: 'center', paddingVertical: 14 },
  cancelTxt: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
});
