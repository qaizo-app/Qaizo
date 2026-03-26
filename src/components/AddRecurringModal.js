// src/components/AddRecurringModal.js
// Модал создания запланированного платежа
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { accountTypeConfig, categoryConfig, colors } from '../theme/colors';
import SwipeModal from './SwipeModal';

const EXP = ['food','restaurant','transport','fuel','health','phone','utilities','clothing','household','kids','entertainment','education','cosmetics','electronics','insurance','rent','arnona','vaad','other'];
const INC = ['salary_me','salary_spouse','rental_income','handyman','sales','other_income'];
const INTERVALS = [1, 2, 3, 6, 12];

export default function AddRecurringModal({ visible, onClose, onSave, editItem }) {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('rent');
  const [recipient, setRecipient] = useState('');
  const [note, setNote] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [selAcc, setSelAcc] = useState('');
  const [intervalMonths, setIntervalMonths] = useState(1);
  const [startDay, setStartDay] = useState('1');
  const [endType, setEndType] = useState('none'); // none, count, date
  const [totalCount, setTotalCount] = useState('12');
  const [endDate, setEndDate] = useState('');
  const isEdit = !!editItem;

  useEffect(() => {
    if (visible) {
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
          setIntervalMonths(editItem.intervalMonths || 1);
          setStartDay(editItem.nextDate ? String(new Date(editItem.nextDate).getDate()) : '1');
          setEndType(editItem.endType || 'none');
          setTotalCount(editItem.totalCount ? String(editItem.totalCount) : '12');
          setEndDate(editItem.endDate || '');
        } else {
          setType('expense'); setAmount(''); setCategoryId('rent');
          setRecipient(''); setNote(''); setIntervalMonths(1);
          setStartDay('1'); setEndType('none'); setTotalCount('12'); setEndDate('');
          if (active.length > 0) setSelAcc(active[0].id);
        }
      });
    }
  }, [visible, editItem]);

  const cats = type === 'income' ? INC : EXP;
  const tc = type === 'expense' ? colors.red : colors.green;
  const getAI = (t) => (accountTypeConfig[t] || accountTypeConfig.bank).icon;

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    const now = new Date();
    const day = parseInt(startDay, 10) || 1;
    let nextMonth = now.getMonth();
    let nextYear = now.getFullYear();
    // Если день уже прошёл в этом месяце — начинаем со следующего
    if (day <= now.getDate()) {
      nextMonth += 1;
      if (nextMonth > 11) { nextMonth = 0; nextYear += 1; }
    }
    const nextDate = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const data = {
      type,
      amount: parseFloat(amount),
      categoryId,
      icon: categoryConfig[categoryId]?.icon || 'repeat',
      recipient: recipient.trim(),
      note: note.trim(),
      currency: '₪',
      account: selAcc,
      intervalMonths,
      nextDate,
      endType,
      totalCount: endType === 'count' ? parseInt(totalCount, 10) || 12 : null,
      endDate: endType === 'date' ? endDate : null,
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

  return (
    <SwipeModal visible={visible} onClose={onClose}>
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
            <Text style={[st.cur, { color: tc }]}>₪</Text>
            <TextInput style={st.amtIn} value={amount} onChangeText={setAmount}
              placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
          </View>

          {/* Счёт */}
          <Text style={st.label}>{i18n.t('account')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {accounts.map(acc => {
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {cats.map(cid => {
              const cfg = categoryConfig[cid] || categoryConfig.other;
              const sl = categoryId === cid;
              return (
                <TouchableOpacity key={cid} style={[st.chip, sl && { borderColor: cfg.color, backgroundColor: `${cfg.color}12` }]}
                  onPress={() => setCategoryId(cid)}>
                  <Feather name={cfg.icon} size={14} color={sl ? cfg.color : colors.textMuted} />
                  <Text style={[st.chipTxt, sl && { color: cfg.color }]} numberOfLines={1}>{i18n.t(cid)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Получатель */}
          <TextInput style={st.input} value={recipient} onChangeText={setRecipient}
            placeholder={i18n.t('payee')} placeholderTextColor={colors.textMuted} />

          {/* Периодичность */}
          <Text style={st.label}>{i18n.t('frequency')}</Text>
          <View style={st.intervalRow}>
            {INTERVALS.map(m => (
              <TouchableOpacity key={m} style={[st.intervalBtn, intervalMonths === m && { borderColor: colors.green, backgroundColor: colors.greenSoft }]}
                onPress={() => setIntervalMonths(m)}>
                <Text style={[st.intervalTxt, intervalMonths === m && { color: colors.green }]}>{intervalLabel(m)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* День месяца */}
          <Text style={st.label}>{i18n.t('dayOfMonth')}</Text>
          <TextInput style={[st.input, { width: 80 }]} value={startDay} onChangeText={setStartDay}
            keyboardType="numeric" placeholder="1" placeholderTextColor={colors.textMuted} />

          {/* Окончание */}
          <Text style={st.label}>{i18n.t('endCondition')}</Text>
          <View style={st.intervalRow}>
            {['none', 'count', 'date'].map(et => {
              const a = endType === et;
              const lb = et === 'none' ? i18n.t('noEnd') : et === 'count' ? i18n.t('afterN') : i18n.t('untilDate');
              return (
                <TouchableOpacity key={et} style={[st.intervalBtn, a && { borderColor: colors.teal, backgroundColor: `${colors.teal}15` }]}
                  onPress={() => setEndType(et)}>
                  <Text style={[st.intervalTxt, a && { color: colors.teal }]}>{lb}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {endType === 'count' && (
            <View style={st.endRow}>
              <Text style={st.endLabel}>{i18n.t('repeatCount')}:</Text>
              <TextInput style={[st.input, { width: 80, marginBottom: 0 }]} value={totalCount}
                onChangeText={setTotalCount} keyboardType="numeric" />
            </View>
          )}

          {endType === 'date' && (
            <View style={st.endRow}>
              <Text style={st.endLabel}>{i18n.t('endDate')}:</Text>
              <TextInput style={[st.input, { width: 140, marginBottom: 0 }]} value={endDate}
                onChangeText={setEndDate} placeholder="2027-03-01" placeholderTextColor={colors.textMuted} />
            </View>
          )}

          {/* Заметка */}
          <TextInput style={st.input} value={note} onChangeText={setNote}
            placeholder={i18n.t('note')} placeholderTextColor={colors.textMuted} />

          {/* Кнопки */}
          <View style={st.btnRow}>
            <TouchableOpacity style={st.cancelBtn} onPress={close}>
              <Text style={st.cancelTxt}>{i18n.t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.saveBtn, { backgroundColor: tc, opacity: amount && parseFloat(amount) > 0 ? 1 : 0.35 }]}
              onPress={handleSave} disabled={!amount || parseFloat(amount) <= 0}>
              <Feather name="check" size={18} color="#fff" style={{ marginEnd: 6 }} />
              <Text style={st.saveTxt}>{i18n.t('save')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SwipeModal>
  );
}

const st = StyleSheet.create({
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 16 },
  typeRow: { flexDirection: 'row', marginBottom: 16, backgroundColor: colors.card, borderRadius: 14, padding: 4 },
  typeBtn: { flex: 1, paddingVertical: 12, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  typeTxt: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  amtRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  cur: { fontSize: 32, fontWeight: '800' },
  amtIn: { flex: 1, color: colors.text, fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  label: { color: colors.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.card, marginEnd: 8, borderWidth: 1.5, borderColor: 'transparent' },
  chipTxt: { color: colors.textDim, fontSize: 13, fontWeight: '500', marginStart: 6, maxWidth: 90 },
  input: { backgroundColor: colors.card, borderRadius: 14, padding: 14, color: colors.text, fontSize: 15, marginBottom: 10, borderWidth: 1, borderColor: colors.cardBorder },
  intervalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  intervalBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder },
  intervalTxt: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  endRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  endLabel: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 18, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  cancelTxt: { color: colors.textDim, fontSize: 16, fontWeight: '600' },
  saveBtn: { flex: 2, flexDirection: 'row', paddingVertical: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});