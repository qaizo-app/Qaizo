// src/components/ExportModal.js
// Экспорт — выбор дат + формат, SwipeModal
import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import exportService from '../services/exportService';
import { colors } from '../theme/colors';
import DatePickerModal from './DatePickerModal';
import SwipeModal from './SwipeModal';

export default function ExportModal({ visible, onClose, onResult }) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showCalFrom, setShowCalFrom] = useState(false);
  const [showCalTo, setShowCalTo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [weekStart, setWeekStart] = useState('sunday');
  const lang = i18n.getLanguage();
  const st = createSt();

  const fmtDate = (d) => {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return `${day}.${m}.${y}`;
  };

  const handleExport = async (format) => {
    setLoading(true);
    try {
      const from = dateFrom || null;
      const to = dateTo || null;
      if (format === 'csv') await exportService.exportCSV(from, to);
      else if (format === 'xls') await exportService.exportXLS(from, to);
      else if (format === 'pdf') await exportService.exportPDF(from, to);
      onResult?.('success');
    } catch (e) {
      if (__DEV__) console.error('Export error:', e);
      if (e.message === 'NO_DATA') onResult?.('noData');
      else onResult?.('error');
    }
    setLoading(false);
    onClose();
  };

  return (
    <>
    <SwipeModal visible={visible} onClose={onClose}>
      <View>
        <Text style={st.title}>{i18n.t('exportData')}</Text>

        {/* Date range */}
        <Text style={st.label}>{i18n.t('period')}</Text>
        <View style={st.dateRow}>
          <TouchableOpacity style={st.dateBtn} onPress={() => setShowCalFrom(true)}>
            <Feather name="calendar" size={14} color={colors.green} />
            <Text style={st.dateTxt}>{dateFrom ? fmtDate(dateFrom) : i18n.t('dateFrom')}</Text>
          </TouchableOpacity>
          <Text style={st.dateSep}>—</Text>
          <TouchableOpacity style={st.dateBtn} onPress={() => setShowCalTo(true)}>
            <Feather name="calendar" size={14} color={colors.green} />
            <Text style={st.dateTxt}>{dateTo ? fmtDate(dateTo) : i18n.t('dateTo')}</Text>
          </TouchableOpacity>
        </View>
        {(dateFrom || dateTo) && (
          <TouchableOpacity onPress={() => { setDateFrom(''); setDateTo(''); }} style={st.clearDates}>
            <Feather name="x" size={12} color={colors.textMuted} />
            <Text style={st.clearDatesTxt}>{i18n.t('allTime')}</Text>
          </TouchableOpacity>
        )}

        {/* Formats */}
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
      </View>
    </SwipeModal>
    <DatePickerModal visible={showCalFrom} onClose={() => setShowCalFrom(false)} onSelect={d => setDateFrom(d)} selectedDate={dateFrom} lang={lang} weekStart={weekStart} />
    <DatePickerModal visible={showCalTo} onClose={() => setShowCalTo(false)} onSelect={d => setDateTo(d)} selectedDate={dateTo} lang={lang} weekStart={weekStart} />
    </>
  );
}

const createSt = () => StyleSheet.create({
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 20 },
  label: { color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10, marginTop: 8 },

  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.bg2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.cardBorder },
  dateTxt: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  dateSep: { color: colors.textMuted, fontSize: 16 },
  clearDates: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  clearDatesTxt: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },

  formats: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  fmtBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 14, backgroundColor: colors.bg2, gap: 8, borderWidth: 1, borderColor: colors.cardBorder },
  fmtTxt: { color: colors.text, fontSize: 14, fontWeight: '700' },

  cancelBtn: { alignItems: 'center', paddingVertical: 16, borderRadius: 14, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.cardBorder },
  cancelTxt: { color: colors.textDim, fontSize: 16, fontWeight: '600' },
});
