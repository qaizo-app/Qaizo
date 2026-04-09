// src/components/SchedulePickerModal.js
// Combined modal: calendar + frequency + end condition (compact)
import { Feather } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import { colors } from '../theme/colors';

const DAYS_RU = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const DAYS_HE = ['א','ב','ג','ד','ה','ו','ש'];
const DAYS_EN = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const MONTHS_RU = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
const MONTHS_HE = ['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ'];
const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const INTERVALS = [1, 2, 3, 6, 12];

function formatDateShort(dateStr, lang) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const m = (lang === 'ru' ? MONTHS_RU : lang === 'he' ? MONTHS_HE : MONTHS_EN)[d.getMonth()];
  return `${d.getDate()} ${m} ${d.getFullYear()}`;
}

export default function SchedulePickerModal({
  visible, onClose, onSave,
  initialDate, initialInterval, initialEndType, initialTotalCount, initialEndDate,
  initialContractEndDate,
  lang = 'ru', weekStart = 'sunday',
}) {
  const today = new Date();
  const sel = initialDate ? new Date(initialDate + 'T00:00:00') : today;
  const [viewYear, setViewYear] = useState(sel.getFullYear());
  const [viewMonth, setViewMonth] = useState(sel.getMonth());
  const [selectedDate, setSelectedDate] = useState(initialDate || '');
  const [intervalMonths, setIntervalMonths] = useState(initialInterval || 1);
  const [endType, setEndType] = useState(initialEndType || 'none');
  const [totalCount, setTotalCount] = useState(initialTotalCount || '12');
  const [endDate, setEndDate] = useState(initialEndDate || '');
  const [contractEnd, setContractEnd] = useState(initialContractEndDate || '');
  const [pickMode, setPickMode] = useState('start'); // 'start', 'end', or 'contract'
  const scrollRef = useRef(null);
  const st = createSt();

  const mNames = lang === 'ru' ? MONTHS_RU : lang === 'he' ? MONTHS_HE : MONTHS_EN;
  const allDays = lang === 'ru' ? DAYS_RU : lang === 'he' ? DAYS_HE : DAYS_EN;

  const wsMap = { sunday: 0, monday: 1, saturday: 6 };
  const wsIdx = wsMap[weekStart] ?? 0;
  const days = [];
  for (let i = 0; i < 7; i++) days.push(allDays[(wsIdx + i) % 7]);

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startDay = (firstDay.getDay() - wsIdx + 7) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isToday = (d) => d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  const matchesDate = (d, dateStr) => {
    if (!dateStr) return false;
    const s = new Date(dateStr + 'T00:00:00');
    return d === s.getDate() && viewMonth === s.getMonth() && viewYear === s.getFullYear();
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const handleSelectDay = (d) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (pickMode === 'end') {
      setEndDate(dateStr);
      setPickMode('start');
    } else if (pickMode === 'contract') {
      setContractEnd(dateStr);
      setPickMode('start');
    } else {
      setSelectedDate(dateStr);
    }
  };

  const handleEndType = (et) => {
    setEndType(et);
    if (et === 'date') setPickMode('end');
    else setPickMode('start');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleSave = () => {
    onSave({ date: selectedDate, intervalMonths, endType, totalCount: endType === 'count' ? totalCount : null, endDate: endType === 'date' ? endDate : null, contractEndDate: contractEnd || null });
    onClose();
  };

  const intervalLabel = (m) => {
    if (m === 1) return i18n.t('everyMonth');
    if (m === 2) return i18n.t('every2Months');
    if (m === 3) return i18n.t('every3Months');
    if (m === 6) return i18n.t('every6Months');
    if (m === 12) return i18n.t('everyYear');
    return `${m}`;
  };

  const accentColor = pickMode === 'end' ? colors.teal : pickMode === 'contract' ? colors.orange : colors.green;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.overlay}>
        <View style={st.modal}>
          <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled">

            {/* Mode indicator */}
            {pickMode === 'end' && (
              <View style={st.modeBanner}>
                <Feather name="calendar" size={14} color={colors.teal} />
                <Text style={st.modeTxt}>{i18n.t('endDate')}</Text>
              </View>
            )}

            {/* Calendar header */}
            <View style={st.calHeader}>
              <TouchableOpacity onPress={prevMonth} style={st.navBtn}>
                <Feather name={i18n.chevronLeft()} size={20} color={colors.text} />
              </TouchableOpacity>
              <Text style={st.monthTitle}>{mNames[viewMonth]} {viewYear}</Text>
              <TouchableOpacity onPress={nextMonth} style={st.navBtn}>
                <Feather name={i18n.chevronRight()} size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Day names */}
            <View style={st.daysRow}>
              {days.map((d, i) => (
                <Text key={i} style={st.dayName}>{d}</Text>
              ))}
            </View>

            {/* Grid */}
            <View style={st.grid}>
              {cells.map((d, i) => {
                const isStart = d && matchesDate(d, selectedDate);
                const isEnd = d && matchesDate(d, endDate);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[st.cell, isStart && st.cellSelected, isEnd && st.cellEnd, d && isToday(d) && !isStart && !isEnd && st.cellToday]}
                    onPress={() => d && handleSelectDay(d)}
                    disabled={!d}
                  >
                    <Text style={[st.cellText, isStart && st.cellTextSelected, isEnd && st.cellTextEnd, d && isToday(d) && !isStart && !isEnd && st.cellTextToday, !d && { color: 'transparent' }]}>
                      {d || ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={st.divider} />

            {/* Frequency */}
            <Text style={st.label}>{i18n.t('frequency')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {INTERVALS.map(m => {
                const active = intervalMonths === m;
                return (
                  <TouchableOpacity key={m} style={[st.chip, active && st.chipActive]} onPress={() => setIntervalMonths(m)}>
                    <Text style={[st.chipTxt, active && st.chipTxtActive]}>{intervalLabel(m)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* End condition */}
            <Text style={st.label}>{i18n.t('endCondition')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {['none', 'count', 'date'].map(et => {
                const active = endType === et;
                const lb = et === 'none' ? i18n.t('noEnd') : et === 'count' ? i18n.t('afterN') : i18n.t('untilDate');
                return (
                  <TouchableOpacity key={et} style={[st.chip, active && st.chipActiveAlt]} onPress={() => handleEndType(et)}>
                    <Text style={[st.chipTxt, active && st.chipTxtActiveAlt]}>{lb}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {endType === 'count' && (
              <View style={st.endRow}>
                <Text style={st.endLabel}>{i18n.t('repeatCount')}:</Text>
                <TextInput style={st.endInput} value={totalCount} onChangeText={setTotalCount} keyboardType="numeric" />
              </View>
            )}

            {endType === 'date' && (
              <TouchableOpacity style={st.endDateBtn} onPress={() => setPickMode('end')}>
                <Feather name="calendar" size={14} color={endDate ? colors.teal : colors.textMuted} />
                <Text style={[st.endDateTxt, endDate && { color: colors.text }]}>
                  {endDate ? formatDateShort(endDate, lang) : i18n.t('endDate')}
                </Text>
                {pickMode === 'end' && <View style={st.pickingDot} />}
              </TouchableOpacity>
            )}

            {/* Contract end date */}
            <Text style={st.sectionLabel}>{i18n.t('contractEnd')}</Text>
            <TouchableOpacity style={[st.endBtn, pickMode === 'contract' && { borderColor: colors.orange }]}
              onPress={() => setPickMode(pickMode === 'contract' ? 'start' : 'contract')}>
              <Feather name="file-text" size={14} color={contractEnd ? colors.orange : colors.textMuted} />
              <Text style={[st.endBtnTxt, contractEnd && { color: colors.orange }]}>
                {contractEnd ? formatDateShort(contractEnd, lang) : i18n.t('optional')}
              </Text>
              {contractEnd ? (
                <TouchableOpacity onPress={() => setContractEnd('')} style={{ marginStart: 'auto' }}>
                  <Feather name="x" size={14} color={colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>

          </ScrollView>

          {/* Footer */}
          <View style={st.footer}>
            <TouchableOpacity style={st.cancelBtn} onPress={onClose}>
              <Text style={st.cancelTxt}>{i18n.t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.saveBtn, !selectedDate && { opacity: 0.4 }]} onPress={handleSave} disabled={!selectedDate}>
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
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: 16 },
  modal: { backgroundColor: colors.bg2, borderRadius: 20, padding: 16, width: '100%', maxHeight: '85%', borderWidth: 1, borderColor: colors.cardBorder },

  modeBanner: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: `${colors.teal}15`, borderRadius: 10, paddingVertical: 6, marginBottom: 10 },
  modeTxt: { color: colors.teal, fontSize: 12, fontWeight: '700' },

  calHeader: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  navBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center' },
  monthTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },

  daysRow: { flexDirection: i18n.row(), marginBottom: 4 },
  dayName: { flex: 1, textAlign: 'center', color: colors.textDim, fontSize: 12, fontWeight: '600' },

  grid: { flexDirection: i18n.row(), flexWrap: 'wrap' },
  cell: { width: '14.28%', paddingVertical: 6, justifyContent: 'center', alignItems: 'center' },
  cellSelected: { backgroundColor: colors.green, borderRadius: 10 },
  cellEnd: { backgroundColor: colors.teal, borderRadius: 10 },
  cellToday: { borderWidth: 1.5, borderColor: colors.green, borderRadius: 10 },
  cellText: { color: colors.text, fontSize: 14, fontWeight: '500' },
  cellTextSelected: { color: colors.bg, fontWeight: '700' },
  cellTextEnd: { color: colors.bg, fontWeight: '700' },
  cellTextToday: { color: colors.green, fontWeight: '700' },

  divider: { height: 1, backgroundColor: colors.divider, marginVertical: 12 },

  label: { color: colors.textDim, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card, marginEnd: 6 },
  chipActive: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  chipActiveAlt: { borderColor: colors.teal, backgroundColor: `${colors.teal}15` },
  chipTxt: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  chipTxtActive: { color: colors.green },
  chipTxtActiveAlt: { color: colors.teal },

  endRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 4 },
  sectionLabel: { color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  endBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.cardBorder, gap: 8, marginBottom: 12 },
  endBtnTxt: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  endLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  endInput: { backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.cardBorder, width: 70 },

  endDateBtn: { flexDirection: i18n.row(), alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 4, marginBottom: 8, borderWidth: 1, borderColor: colors.cardBorder },
  endDateTxt: { color: colors.textMuted, fontSize: 12, fontWeight: '600', flex: 1 },
  pickingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.teal },

  footer: { flexDirection: i18n.row(), gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.divider },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.card, alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  cancelTxt: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  saveBtn: { flex: 2, flexDirection: i18n.row(), paddingVertical: 12, borderRadius: 12, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', gap: 6 },
  saveTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
