// src/components/DatePickerModal.js
// Стилизированный календарь в тёмной теме
import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import { colors } from '../theme/colors';

// Дни по индексу JS (0=Sun, 1=Mon, ... 6=Sat)
const DAYS_RU = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const DAYS_HE = ['א','ב','ג','ד','ה','ו','ש'];
const DAYS_EN = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function DatePickerModal({ visible, onClose, onSelect, selectedDate, lang = 'ru', weekStart = 'monday' }) {
  const today = new Date();
  const sel = selectedDate ? new Date(selectedDate) : today;
  const [viewYear, setViewYear] = useState(sel.getFullYear());
  const [viewMonth, setViewMonth] = useState(sel.getMonth());
  const styles = createStyles();

  const months = lang === 'ru' ? MONTHS_RU : lang === 'he' ? MONTHS_HE : MONTHS_EN;
  const allDays = lang === 'ru' ? DAYS_RU : lang === 'he' ? DAYS_HE : DAYS_EN;

  // Начало недели: sunday=0, monday=1, saturday=6
  const wsMap = { sunday: 0, monday: 1, saturday: 6 };
  const wsIdx = wsMap[weekStart] ?? 1;

  // Переупорядочить дни от wsIdx
  const days = [];
  for (let i = 0; i < 7; i++) days.push(allDays[(wsIdx + i) % 7]);

  const firstDay = new Date(viewYear, viewMonth, 1);
  let startDay = (firstDay.getDay() - wsIdx + 7) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isToday = (d) => d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
  const isSelected = (d) => {
    if (!selectedDate) return false;
    return d === sel.getDate() && viewMonth === sel.getMonth() && viewYear === sel.getFullYear();
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const handleSelect = (d) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    onSelect(dateStr);
    onClose();
  };

  const handleToday = () => {
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    onSelect(dateStr);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
              <Feather name={i18n.chevronLeft()} size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{months[viewMonth]} {viewYear}</Text>
            <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
              <Feather name={i18n.chevronRight()} size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Day names */}
          <View style={styles.daysRow}>
            {days.map((d, i) => (
              <Text key={i} style={[styles.dayName, (i === 5 || i === 6) && { color: colors.textMuted }]}>{d}</Text>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={styles.grid}>
            {cells.map((d, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.cell,
                  d && isSelected(d) && styles.cellSelected,
                  d && isToday(d) && !isSelected(d) && styles.cellToday,
                ]}
                onPress={() => d && handleSelect(d)}
                disabled={!d}
              >
                <Text style={[
                  styles.cellText,
                  d && isSelected(d) && styles.cellTextSelected,
                  d && isToday(d) && !isSelected(d) && styles.cellTextToday,
                  !d && { color: 'transparent' },
                ]}>
                  {d || ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.todayBtn} onPress={handleToday}>
              <Feather name="calendar" size={14} color={colors.green} />
              <Text style={styles.todayText}>
                {lang === 'ru' ? 'Сегодня' : lang === 'he' ? 'היום' : 'Today'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>
                {lang === 'ru' ? 'Закрыть' : lang === 'he' ? 'סגור' : 'Close'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = () => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: 24 },
  modal: { backgroundColor: colors.bg2, borderRadius: 24, padding: 20, width: '100%', borderWidth: 1, borderColor: colors.cardBorder },

  header: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  navBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center' },
  monthTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },

  daysRow: { flexDirection: i18n.row(), marginBottom: 8 },
  dayName: { flex: 1, textAlign: 'center', color: colors.textDim, fontSize: 12, fontWeight: '600' },

  grid: { flexDirection: i18n.row(), flexWrap: 'wrap' },
  cell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  cellSelected: { backgroundColor: colors.green, borderRadius: 12 },
  cellToday: { borderWidth: 1.5, borderColor: colors.green, borderRadius: 12 },
  cellText: { color: colors.text, fontSize: 14, fontWeight: '500' },
  cellTextSelected: { color: colors.bg, fontWeight: '700' },
  cellTextToday: { color: colors.green, fontWeight: '700' },

  footer: { flexDirection: i18n.row(), justifyContent: 'space-between', marginTop: 16 },
  todayBtn: { flexDirection: i18n.row(), alignItems: 'center', padding: 12 },
  todayText: { color: colors.green, fontSize: 14, fontWeight: '600', marginStart: 6 },
  closeBtn: { padding: 12 },
  closeText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
});