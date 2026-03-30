// src/screens/CalendarScreen.js
// Calendar view — income/expense per day, tap day → transaction list
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Amount from '../components/Amount';
import Card from '../components/Card';
import CategoryIcon from '../components/CategoryIcon';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { colors } from '../theme/colors';

const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const DAYS_RU = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const DAYS_HE = ['א','ב','ג','ד','ה','ו','ש'];
const DAYS_EN = ['Su','Mo','Tu','We','Th','Fr','Sa'];

export default function CalendarScreen() {
  const [transactions, setTransactions] = useState([]);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState(null);
  const [weekStart, setWeekStart] = useState('sunday');
  const st = createSt();
  const lang = i18n.getLanguage();
  const today = new Date();

  useFocusEffect(useCallback(() => {
    Promise.all([dataService.getTransactions(), dataService.getSettings()]).then(([txs, settings]) => {
      setTransactions(txs);
      if (settings.weekStart) setWeekStart(settings.weekStart);
    });
  }, []));

  const months = lang === 'ru' ? MONTHS_RU : lang === 'he' ? MONTHS_HE : MONTHS_EN;
  const allDays = lang === 'ru' ? DAYS_RU : lang === 'he' ? DAYS_HE : DAYS_EN;

  // Week start
  const wsMap = { sunday: 0, monday: 1, saturday: 6 };
  const wsIdx = wsMap[weekStart] ?? 0;
  const days = [];
  for (let i = 0; i < 7; i++) days.push(allDays[(wsIdx + i) % 7]);

  // Calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1);
  const startDay = (firstDay.getDay() - wsIdx + 7) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Aggregate transactions by date
  const dayData = {};
  transactions.forEach(tx => {
    const d = (tx.date || tx.createdAt || '').slice(0, 10);
    if (!d) return;
    const [y, m] = d.split('-').map(Number);
    if (y !== viewYear || m - 1 !== viewMonth) return;
    const day = parseInt(d.split('-')[2], 10);
    if (!dayData[day]) dayData[day] = { income: 0, expense: 0, txs: [] };
    if (tx.type === 'income') dayData[day].income += tx.amount;
    else if (tx.type === 'expense') dayData[day].expense += tx.amount;
    dayData[day].txs.push(tx);
  });

  // Monthly totals
  const monthIncome = Object.values(dayData).reduce((s, d) => s + d.income, 0);
  const monthExpense = Object.values(dayData).reduce((s, d) => s + d.expense, 0);

  const isToday = (d) => d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
    setSelectedDate(null);
  };

  const selectedTxs = selectedDate && dayData[selectedDate] ? dayData[selectedDate].txs : [];

  const formatAmount = (n) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <View style={st.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={st.header}>
          <Text style={st.title}>{i18n.t('calendarView')}</Text>
        </View>

        {/* Month summary */}
        <Card style={{ marginHorizontal: 20 }}>
          <View style={st.summaryRow}>
            <View style={st.summaryItem}>
              <Text style={st.summaryLabel}>{i18n.t('income')}</Text>
              <Amount value={monthIncome} sign style={st.summaryVal} color={colors.green} numberOfLines={1} adjustsFontSizeToFit />
            </View>
            <View style={st.summaryDivider} />
            <View style={st.summaryItem}>
              <Text style={st.summaryLabel}>{i18n.t('expenses')}</Text>
              <Amount value={-monthExpense} sign style={st.summaryVal} color={colors.red} numberOfLines={1} adjustsFontSizeToFit />
            </View>
          </View>
        </Card>

        {/* Calendar */}
        <Card style={{ marginHorizontal: 20, marginTop: 12 }}>
          {/* Nav */}
          <View style={st.navRow}>
            <TouchableOpacity onPress={prevMonth} style={st.navBtn}>
              <Feather name={i18n.chevronLeft()} size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={st.monthTitle}>{months[viewMonth]} {viewYear}</Text>
            <TouchableOpacity onPress={nextMonth} style={st.navBtn}>
              <Feather name={i18n.chevronRight()} size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Day names */}
          <View style={st.daysRow}>
            {days.map((d, i) => (
              <Text key={i} style={[st.dayName, (i === 5 || i === 6) && { color: colors.textMuted }]}>{d}</Text>
            ))}
          </View>

          {/* Grid */}
          <View style={st.grid}>
            {cells.map((d, i) => {
              const data = d ? dayData[d] : null;
              const isSel = selectedDate === d;
              const hasData = data && (data.income > 0 || data.expense > 0);
              return (
                <TouchableOpacity
                  key={i}
                  style={[st.cell, isSel && st.cellSelected, d && isToday(d) && !isSel && st.cellToday]}
                  onPress={() => d && setSelectedDate(selectedDate === d ? null : d)}
                  disabled={!d}
                  activeOpacity={0.6}
                >
                  <Text style={[st.cellDay, isSel && st.cellDaySelected, d && isToday(d) && !isSel && { color: colors.green }, !d && { color: 'transparent' }]}>
                    {d || ''}
                  </Text>
                  {hasData && (
                    <View style={st.cellAmounts}>
                      {data.income > 0 && <View style={[st.cellDot, { backgroundColor: colors.green }]} />}
                      {data.expense > 0 && <View style={[st.cellDot, { backgroundColor: colors.red }]} />}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* Selected day transactions */}
        {selectedDate && (
          <Card style={{ marginHorizontal: 20, marginTop: 12 }}>
            <View style={st.dayHeader}>
              <Text style={st.dayTitle}>
                {selectedDate} {months[viewMonth]}
              </Text>
              {dayData[selectedDate] && (
                <View style={st.dayTotals}>
                  {dayData[selectedDate].income > 0 && (
                    <Amount value={dayData[selectedDate].income} style={st.dayTotal} color={colors.green} />
                  )}
                  {dayData[selectedDate].expense > 0 && (
                    <Amount value={-dayData[selectedDate].expense} sign style={st.dayTotal} color={colors.red} />
                  )}
                </View>
              )}
            </View>

            {selectedTxs.length > 0 ? (
              selectedTxs.map((tx, idx) => (
                <View key={tx.id || idx} style={[st.txRow, idx < selectedTxs.length - 1 && st.txBorder]}>
                  <CategoryIcon categoryId={tx.categoryId} size="small" />
                  <View style={st.txInfo}>
                    <Text style={st.txCat}>{i18n.t(tx.categoryId)}</Text>
                    {tx.recipient ? <Text style={st.txRecipient} numberOfLines={1}>{tx.recipient}</Text> : null}
                  </View>
                  <Amount value={tx.type === 'income' ? tx.amount : -tx.amount} sign style={st.txAmount} color={tx.type === 'income' ? colors.green : colors.red} />
                </View>
              ))
            ) : (
              <Text style={st.emptyTxt}>{i18n.t('noTransactions')}</Text>
            )}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const createSt = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', textAlign: i18n.textAlign() },

  summaryRow: { flexDirection: i18n.row(), alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, height: 30, backgroundColor: colors.divider },
  summaryLabel: { color: colors.textDim, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  summaryVal: { fontSize: 15, fontWeight: '800', writingDirection: 'ltr' },

  navRow: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  navBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.bg2, justifyContent: 'center', alignItems: 'center' },
  monthTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },

  daysRow: { flexDirection: i18n.row(), marginBottom: 8 },
  dayName: { flex: 1, textAlign: 'center', color: colors.textDim, fontSize: 11, fontWeight: '600' },

  grid: { flexDirection: i18n.row(), flexWrap: 'wrap' },
  cell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 2, borderRadius: 10 },
  cellSelected: { backgroundColor: colors.green + '20', borderWidth: 1.5, borderColor: colors.green },
  cellToday: { borderWidth: 1, borderColor: colors.green + '40' },
  cellDay: { color: colors.text, fontSize: 13, fontWeight: '500' },
  cellDaySelected: { color: colors.green, fontWeight: '700' },
  cellAmounts: { flexDirection: 'row', gap: 2, marginTop: 2 },
  cellDot: { width: 5, height: 5, borderRadius: 3 },

  dayHeader: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dayTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  dayTotals: { flexDirection: i18n.row(), gap: 10 },
  dayTotal: { fontSize: 13, fontWeight: '700' },

  txRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 12, paddingVertical: 10 },
  txBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  txInfo: { flex: 1 },
  txCat: { color: colors.text, fontSize: 14, fontWeight: '600', textAlign: i18n.textAlign() },
  txRecipient: { color: colors.textMuted, fontSize: 12, marginTop: 2, textAlign: i18n.textAlign() },
  txAmount: { fontSize: 14, fontWeight: '700', writingDirection: 'ltr' },
  emptyTxt: { color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 16 },
});
