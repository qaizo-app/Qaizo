// src/components/AddRecurringModal.js
// Модал создания запланированного платежа
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { accountTypeConfig, categoryConfig, colors } from '../theme/colors';
import { sym } from '../utils/currency';
import CategoryPickerModal, { getCatName, getCatIcon, DEFAULT_GROUPS } from './CategoryPickerModal';
import SchedulePickerModal from './SchedulePickerModal';
import SwipeModal from './SwipeModal';

const INC = ['salary_me','salary_spouse','rental_income','handyman','sales','other_income'];
const EXP = Object.keys(categoryConfig).filter(k => !['salary_me','salary_spouse','rental_income','handyman','sales','other_income','transfer'].includes(k));

export default function AddRecurringModal({ visible, onClose, onSave, editItem }) {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('rent');
  const [recipient, setRecipient] = useState('');
  const [note, setNote] = useState('');
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [catGroups, setCatGroups] = useState(DEFAULT_GROUPS);
  const [accounts, setAccounts] = useState([]);
  const [selAcc, setSelAcc] = useState('');
  const [startDate, setStartDate] = useState('');
  const [intervalMonths, setIntervalMonths] = useState(1);
  const [endType, setEndType] = useState('none');
  const [totalCount, setTotalCount] = useState('12');
  const [endDate, setEndDate] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [notify, setNotify] = useState(true);
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [contractEndDate, setContractEndDate] = useState('');
  const isEdit = !!editItem;
  const st = createSt();

  useEffect(() => {
    if (visible) {
      dataService.getCategories().then(saved => { if (saved && saved.length > 0) setCatGroups(saved); });
      dataService.getAccounts().then(accs => {
        const active = accs.filter(a => a.isActive !== false);
        setAccounts(active);
        if (editItem) {
          setType(editItem.type || 'expense');
          setAmount(String(editItem.amount));
          setCategoryId(editItem.categoryId || 'rent');
          setRecipient(editItem.recipient || '');
          setNote(editItem.note || '');
          setSelAcc(editItem.account || (active[0]?.id || ''));
          setStartDate(editItem.nextDate ? editItem.nextDate.slice(0, 10) : '');
          setIntervalMonths(editItem.intervalMonths || 1);
          setEndType(editItem.endType || 'none');
          setTotalCount(editItem.totalCount ? String(editItem.totalCount) : '12');
          setEndDate(editItem.endDate || '');
          setNotify(editItem.notify !== false);
          setAutoConfirm(editItem.autoConfirm === true);
          setContractEndDate(editItem.contractEndDate || '');
        } else {
          setType('expense'); setAmount(''); setCategoryId('rent');
          setRecipient(''); setNote(''); setIntervalMonths(1);
          setStartDate(''); setEndType('none'); setTotalCount('12'); setEndDate('');
          setNotify(true); setAutoConfirm(false); setContractEndDate('');
          if (active.length > 0) setSelAcc(active[0].id);
        }
      });
    }
  }, [visible, editItem]);

  const cats = type === 'income' ? INC : EXP;
  const tc = type === 'expense' ? colors.red : colors.green;
  const getAI = (t) => (accountTypeConfig[t] || accountTypeConfig.bank).icon;

  const handleSave = async () => {
    if (!amount || parseFloat(amount.replace(',', '.')) <= 0) return;
    let nextDate = startDate;
    if (!nextDate) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      nextDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    }

    const data = {
      type,
      amount: parseFloat(amount.replace(',', '.')),
      categoryId,
      icon: categoryConfig[categoryId]?.icon || 'repeat',
      recipient: recipient.trim(),
      note: note.trim(),
      currency: sym(),
      account: selAcc,
      intervalMonths,
      nextDate,
      endType,
      totalCount: endType === 'count' ? parseInt(totalCount, 10) || 12 : null,
      endDate: endType === 'date' ? endDate : null,
      notify,
      autoConfirm,
      contractEndDate: contractEndDate || null,
    };

    if (isEdit) {
      await dataService.updateRecurring(editItem.id, data);
    } else {
      await dataService.addRecurring(data);
    }
    onSave?.();
    onClose?.();
  };

  const intervalLabel = (m) => {
    if (m === 1) return i18n.t('everyMonth');
    if (m === 2) return i18n.t('every2Months');
    if (m === 3) return i18n.t('every3Months');
    if (m === 6) return i18n.t('every6Months');
    if (m === 12) return i18n.t('everyYear');
    return `${m}`;
  };

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    const lang = i18n.getLanguage();
    const monthNames = {
      ru: ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'],
      he: ['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ'],
      en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    };
    const m = (monthNames[lang] || monthNames.en)[d.getMonth()];
    return `${d.getDate()} ${m} ${d.getFullYear()}`;
  };

  const handleScheduleSave = (schedule) => {
    setStartDate(schedule.date);
    setIntervalMonths(schedule.intervalMonths);
    setEndType(schedule.endType);
    if (schedule.totalCount) setTotalCount(schedule.totalCount);
    if (schedule.endDate) setEndDate(schedule.endDate);
    if (schedule.contractEndDate !== undefined) setContractEndDate(schedule.contractEndDate || '');
  };

  // Build schedule summary text
  const scheduleSummary = () => {
    const parts = [];
    if (startDate) parts.push(formatDate(startDate));
    parts.push(intervalLabel(intervalMonths));
    if (endType === 'count') parts.push(`× ${totalCount}`);
    if (endType === 'date' && endDate) parts.push(`${i18n.t('until')} ${formatDate(endDate)}`);
    return parts.join(' · ');
  };

  return (
    <>
    <SwipeModal visible={visible} onClose={onClose} footer={({ close }) => (
        <View style={st.btnRow}>
          <TouchableOpacity style={st.cancelBtn} onPress={close}>
            <Text style={st.cancelTxt}>{i18n.t('cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[st.saveBtn, { backgroundColor: tc, opacity: amount && parseFloat(amount.replace(',', '.')) > 0 ? 1 : 0.35 }]}
            onPress={handleSave} disabled={!amount || parseFloat(amount.replace(',', '.')) <= 0}>
            <Feather name="check" size={18} color="#fff" style={{ marginEnd: 6 }} />
            <Text style={st.saveTxt}>{i18n.t('save')}</Text>
          </TouchableOpacity>
        </View>
      )}>
      {({ close }) => (
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={st.title}>{isEdit ? i18n.t('edit') : i18n.t('newRecurring')}</Text>

          {/* Тип */}
          <View style={st.typeRow}>
            {['expense', 'income'].map(t => {
              const a = type === t;
              const c = t === 'expense' ? colors.red : colors.green;
              return (
                <TouchableOpacity key={t} style={[st.typeBtn, a && { backgroundColor: `${c}15`, borderWidth: 1, borderColor: `${c}40` }]}
                  onPress={() => { setType(t); setCategoryId(t === 'income' ? 'salary_me' : 'rent'); }}>
                  <Text style={[st.typeTxt, a && { color: colors.text }]}>
                    {t === 'expense' ? i18n.t('expenseType') : i18n.t('incomeType')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Сумма */}
          <View style={st.amtRow}>
            <Text style={[st.cur, { color: tc, fontSize: amtFont(amount, 32) }]}>{sym()}</Text>
            <TextInput style={[st.amtIn, { fontSize: amtFont(amount, 32) }]} value={amount} onChangeText={setAmount}
              placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
          </View>

          {/* Счёт */}
          <Text style={st.label}>{i18n.t('account')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {accounts.filter(acc => type === 'income' ? ['cash', 'bank'].includes(acc.type) : ['cash', 'bank', 'credit'].includes(acc.type)).map(acc => {
              const sl = selAcc === acc.id;
              return (
                <TouchableOpacity key={acc.id} style={[st.chip, sl && { borderColor: tc, backgroundColor: `${tc}10` }]}
                  onPress={() => setSelAcc(acc.id)}>
                  <MaterialCommunityIcons name={getAI(acc.type)} size={14} color={sl ? tc : colors.textMuted} />
                  <Text style={[st.chipTxt, sl && { color: colors.text }]} numberOfLines={1}>{acc.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Категория */}
          <Text style={st.label}>{i18n.t('category')}</Text>
          {(() => { const ci = getCatIcon(categoryId, catGroups); return (
          <TouchableOpacity style={st.catPickerBtn} onPress={() => setShowCatPicker(true)} activeOpacity={0.7}>
            <View style={[st.catPickerIcon, { backgroundColor: ci.color + '18' }]}>
              <Feather name={ci.icon} size={20} color={ci.color} />
            </View>
            <Text style={st.catPickerText}>{getCatName(categoryId, catGroups, i18n.getLanguage())}</Text>
            <Feather name="chevron-down" size={18} color={colors.textMuted} />
          </TouchableOpacity>); })()}

          {/* Получатель */}
          <TextInput style={st.input} value={recipient} onChangeText={setRecipient}
            placeholder={i18n.t('payee')} placeholderTextColor={colors.textMuted} />

          {/* Расписание — одна кнопка */}
          <TouchableOpacity style={st.scheduleBtn} onPress={() => setShowSchedule(true)}>
            <Feather name="calendar" size={18} color={startDate ? colors.green : colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={[st.scheduleTxt, startDate && { color: colors.text }]}>
                {startDate ? scheduleSummary() : i18n.t('frequency')}
              </Text>
            </View>
            <Feather name={i18n.chevronRight()} size={16} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Заметка */}
          <TextInput style={st.input} value={note} onChangeText={setNote}
            placeholder={i18n.t('note')} placeholderTextColor={colors.textMuted} />

          {/* התראות */}
          <View style={st.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={st.toggleLabel}>{i18n.t('notifications')}</Text>
              <Text style={st.toggleSub}>{i18n.t('notifyBeforePayment')}</Text>
            </View>
            <Switch value={notify} onValueChange={setNotify}
              trackColor={{ false: colors.card, true: `${tc}40` }}
              thumbColor={notify ? tc : colors.textMuted} />
          </View>

          {/* Auto-confirm */}
          <View style={st.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={st.toggleLabel}>{i18n.t('autoConfirm')}</Text>
              <Text style={st.toggleSub}>{i18n.t('autoConfirmSub')}</Text>
            </View>
            <Switch value={autoConfirm} onValueChange={setAutoConfirm}
              trackColor={{ false: colors.card, true: `${tc}40` }}
              thumbColor={autoConfirm ? tc : colors.textMuted} />
          </View>

          <SchedulePickerModal
            visible={showSchedule}
            onClose={() => setShowSchedule(false)}
            onSave={handleScheduleSave}
            initialDate={startDate}
            initialInterval={intervalMonths}
            initialEndType={endType}
            initialTotalCount={totalCount}
            initialEndDate={endDate}
            initialContractEndDate={contractEndDate}
            lang={i18n.getLanguage()}
          />
        </ScrollView>
      )}
    </SwipeModal>
    <CategoryPickerModal visible={showCatPicker} onClose={() => setShowCatPicker(false)} onSelect={setCategoryId} type={type} />
    </>
  );
}

function amtFont(val, base) {
  const len = (val || '').length;
  if (len <= 4) return base;
  if (len <= 6) return Math.round(base * 0.8);
  return Math.round(base * 0.65);
}

const createSt = () => StyleSheet.create({
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 16, textAlign: i18n.textAlign() },
  typeRow: { flexDirection: i18n.row(), marginBottom: 16, backgroundColor: colors.card, borderRadius: 14, padding: 4 },
  typeBtn: { flex: 1, paddingVertical: 12, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  typeTxt: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  amtRow: { flexDirection: i18n.row(), alignItems: 'center', marginBottom: 16, gap: 12 },
  cur: { fontSize: 32, fontWeight: '800' },
  amtIn: { flex: 1, color: colors.text, fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  label: { color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 4, textAlign: i18n.textAlign() },
  chip: { flexDirection: i18n.row(), alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.card, marginEnd: 8, borderWidth: 1.5, borderColor: 'transparent' },
  chipTxt: { color: colors.textDim, fontSize: 12, fontWeight: '500', marginStart: 6, maxWidth: 90 },
  catPickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.cardBorder, gap: 12 },
  catPickerIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  catPickerText: { color: colors.text, fontSize: 16, fontWeight: '600', flex: 1 },
  input: { backgroundColor: colors.card, borderRadius: 14, padding: 14, color: colors.text, fontSize: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.cardBorder, textAlign: i18n.textAlign() },
  scheduleBtn: { flexDirection: i18n.row(), alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.cardBorder },
  scheduleTxt: { color: colors.textMuted, fontSize: 14, fontWeight: '600', textAlign: i18n.textAlign() },
  btnRow: { flexDirection: i18n.row(), gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  dateBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.cardBorder, gap: 8, marginBottom: 12 },
  dateTxt: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, marginBottom: 8 },
  toggleLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  toggleSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  cancelTxt: { color: colors.textDim, fontSize: 16, fontWeight: '600' },
  saveBtn: { flex: 2, flexDirection: i18n.row(), paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
