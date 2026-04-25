// src/components/AddRecurringModal.js
// Модал создания запланированного платежа
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { accountTypeConfig, categoryConfig, colors } from '../theme/colors';
import { sym } from '../utils/currency';
import CategoryPickerModal, { getCatName, getCatIcon, DEFAULT_GROUPS } from './CategoryPickerModal';
import SchedulePickerModal from './SchedulePickerModal';
import SwipeModal from './SwipeModal';

const INC = ['salary_me','salary_spouse','rental_income','handyman','sales','keren_hishtalmut','pension','other_income'];
const EXP = Object.keys(categoryConfig).filter(k => !['salary_me','salary_spouse','rental_income','handyman','sales','keren_hishtalmut','pension','other_income','transfer'].includes(k));

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
  const [toAcc, setToAcc] = useState('');
  const [startDate, setStartDate] = useState('');
  const [intervalMonths, setIntervalMonths] = useState(1);
  const [endType, setEndType] = useState('none');
  const [totalCount, setTotalCount] = useState('12');
  const [endDate, setEndDate] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [notify, setNotify] = useState(true);
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [contractEndDate, setContractEndDate] = useState('');
  const [tags, setTags] = useState([]);
  const [userTags, setUserTags] = useState([]);
  const [newTagText, setNewTagText] = useState('');
  const isEdit = !!editItem;
  const st = createSt();

  useEffect(() => {
    if (!visible) return;

    // Reset form SYNCHRONOUSLY on open — don't wait on getAccounts() to settle,
    // or stale values from the previous session leak into the new one when the
    // promise is slow or rejects silently.
    if (editItem) {
      setType(editItem.isTransfer ? 'transfer' : (editItem.type || 'expense'));
      setAmount(String(editItem.amount));
      setCategoryId(editItem.categoryId || 'rent');
      setRecipient(editItem.recipient || '');
      setNote(editItem.note || '');
      setSelAcc(editItem.account || '');
      setToAcc(editItem.toAccount || '');
      setStartDate(editItem.nextDate ? editItem.nextDate.slice(0, 10) : '');
      setIntervalMonths(editItem.intervalMonths || 1);
      setEndType(editItem.endType || 'none');
      setTotalCount(editItem.totalCount ? String(editItem.totalCount) : '12');
      setEndDate(editItem.endDate || '');
      setNotify(editItem.notify !== false);
      setAutoConfirm(editItem.autoConfirm === true);
      setContractEndDate(editItem.contractEndDate || '');
      setTags(Array.isArray(editItem.tags) ? editItem.tags : []);
    } else {
      setType('expense');
      setAmount('');
      setCategoryId('food');
      setRecipient('');
      setNote('');
      setSelAcc('');
      setToAcc('');
      setStartDate('');
      setIntervalMonths(1);
      setEndType('none');
      setTotalCount('12');
      setEndDate('');
      setNotify(true);
      setAutoConfirm(false);
      setContractEndDate('');
      setTags([]);
      setShowCatPicker(false);
      setShowSchedule(false);
    }
    setNewTagText('');

    // Side data — doesn't feed into form defaults for a NEW item except
    // the default account, which is filled in once accounts arrive.
    dataService.getCategories().then(saved => {
      if (saved && saved.length > 0) setCatGroups(saved);
    });
    dataService.getAccounts().then(accs => {
      const active = accs.filter(a => a.isActive !== false);
      setAccounts(active);
      if (!editItem && active.length > 0) {
        setSelAcc(prev => prev || active[0].id);
      }
    });
    dataService.getTags().then(saved => {
      if (Array.isArray(saved)) setUserTags(saved);
    });
  }, [visible, editItem]);

  const togTag = (tag) => setTags(p => p.includes(tag) ? p.filter(t => t !== tag) : [...p, tag]);

  const cats = type === 'income' ? INC : EXP;
  const tc = type === 'expense' ? colors.red : type === 'income' ? colors.green : colors.blue;
  const getAI = (t) => (accountTypeConfig[t] || accountTypeConfig.bank).icon;

  const transferReady = type !== 'transfer' || (selAcc && toAcc && selAcc !== toAcc);

  const handleSave = async () => {
    if (!amount || parseFloat(amount.replace(',', '.')) <= 0) return;
    let nextDate = startDate;
    if (!nextDate) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      nextDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    }

    const isTransfer = type === 'transfer';
    if (isTransfer && (!selAcc || !toAcc || selAcc === toAcc)) return;

    // Resolve icon/color/name from the user's actual category groups so
    // custom categories (ids like "аренда_1tyf") don't fall back to the
    // generic "other" icon or leak the raw id into the list as a name.
    const picked = isTransfer ? null : getCatIcon(categoryId, catGroups);
    const resolvedName = isTransfer ? '' : getCatName(categoryId, catGroups, i18n.getLanguage());

    const data = {
      // Persist type as 'expense' for transfers so legacy filters that group
      // on type keep working; isTransfer + toAccount flag the pair at confirm.
      type: isTransfer ? 'expense' : type,
      amount: parseFloat(amount.replace(',', '.')),
      categoryId: isTransfer ? 'transfer' : categoryId,
      categoryName: resolvedName,
      icon: isTransfer ? 'repeat' : (picked?.icon || 'circle'),
      iconColor: isTransfer ? null : (picked?.color || null),
      recipient: isTransfer ? '' : recipient.trim(),
      note: note.trim(),
      currency: sym(),
      account: selAcc,
      toAccount: isTransfer ? toAcc : null,
      isTransfer: isTransfer || false,
      intervalMonths,
      nextDate,
      endType,
      totalCount: endType === 'count' ? parseInt(totalCount, 10) || 12 : null,
      endDate: endType === 'date' ? endDate : null,
      notify,
      autoConfirm,
      contractEndDate: contractEndDate || null,
      tags: Array.isArray(tags) ? tags : [],
    };

    let saved = null;
    if (isEdit) {
      await dataService.updateRecurring(editItem.id, data);
      saved = { ...editItem, ...data };
    } else {
      saved = await dataService.addRecurring(data);
    }
    onClose?.();
    // Pass the persisted item back so the parent can append to its state
    // immediately, bypassing the Firestore offline-cache propagation delay
    // that caused new recurring payments to appear only on next focus.
    onSave?.(saved);
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
          <TouchableOpacity style={[st.saveBtn, { backgroundColor: tc, opacity: (amount && parseFloat(amount.replace(',', '.')) > 0 && transferReady) ? 1 : 0.35 }]}
            onPress={handleSave} disabled={!amount || parseFloat(amount.replace(',', '.')) <= 0 || !transferReady}>
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
            {['expense', 'income', 'transfer'].map(t => {
              const a = type === t;
              const c = t === 'expense' ? colors.red : t === 'income' ? colors.green : colors.blue;
              const label = t === 'expense'
                ? i18n.t('expenseType')
                : t === 'income'
                  ? i18n.t('incomeType')
                  : i18n.t('transfer');
              return (
                <TouchableOpacity key={t} style={[st.typeBtn, a && { backgroundColor: `${c}15`, borderWidth: 1, borderColor: `${c}40` }]}
                  onPress={() => {
                    setType(t);
                    if (t === 'income') setCategoryId('salary_me');
                    else if (t === 'expense') setCategoryId('food');
                    else setCategoryId('transfer');
                  }}>
                  <Text style={[st.typeTxt, a && { color: colors.text }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Сумма */}
          <View style={st.amtRow}>
            <TextInput style={[st.amtIn, { fontSize: amtFont(amount, 32) }]} value={amount} onChangeText={setAmount}
              placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
            <Text style={[st.cur, { color: tc, fontSize: amtFont(amount, 32) }]}>{sym()}</Text>
          </View>

          {type === 'transfer' ? (
            <>
              {/* Откуда */}
              <Text style={st.label}>{i18n.t('from')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {accounts.filter(acc => ['cash', 'bank', 'credit'].includes(acc.type)).map(acc => {
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

              {/* Куда */}
              <Text style={st.label}>{i18n.t('to')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {accounts.filter(acc => ['cash', 'bank', 'credit'].includes(acc.type) && acc.id !== selAcc).map(acc => {
                  const sl = toAcc === acc.id;
                  return (
                    <TouchableOpacity key={acc.id} style={[st.chip, sl && { borderColor: colors.blue, backgroundColor: colors.blueSoft }]}
                      onPress={() => setToAcc(acc.id)}>
                      <MaterialCommunityIcons name={getAI(acc.type)} size={14} color={sl ? colors.blue : colors.textMuted} />
                      <Text style={[st.chipTxt, sl && { color: colors.text }]} numberOfLines={1}>{acc.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          ) : (
            <>
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
                  {ci.icon?.startsWith('ion:')
                    ? <Ionicons name={ci.icon.slice(4)} size={20} color={ci.color} />
                    : <Feather name={ci.icon} size={20} color={ci.color} />}
                </View>
                <Text style={st.catPickerText}>{getCatName(categoryId, catGroups, i18n.getLanguage())}</Text>
                <Feather name="chevron-down" size={18} color={colors.textMuted} />
              </TouchableOpacity>); })()}

              {/* Получатель */}
              <TextInput style={st.input} value={recipient} onChangeText={setRecipient}
                placeholder={i18n.t('payee')} placeholderTextColor={colors.textMuted} />
            </>
          )}

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

          {/* Теги */}
          <Text style={st.label}>{i18n.t('tags')}</Text>
          <View style={st.tagsRow}>
            {userTags.map((tag, idx) => {
              const tagColors = ['#34d399','#60a5fa','#fb923c','#a78bfa','#f472b6','#fbbf24','#2dd4bf','#f87171'];
              const tgC = tagColors[idx % tagColors.length];
              const sl = tags.includes(tag);
              return (
                <TouchableOpacity key={tag} style={[st.tagChip, sl && { borderColor: tgC, backgroundColor: `${tgC}15` }]}
                  onPress={() => togTag(tag)}
                  onLongPress={() => {
                    dataService.deleteTag(tag);
                    setUserTags(prev => prev.filter(t => t !== tag));
                    setTags(prev => prev.filter(t => t !== tag));
                  }}>
                  <Text style={[st.tagTxt, sl && { color: tgC }]}>{tag}</Text>
                </TouchableOpacity>
              );
            })}
            <View style={st.newTagWrap}>
              <TextInput
                style={st.newTagInput}
                value={newTagText}
                onChangeText={setNewTagText}
                placeholder={i18n.t('newTag')}
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                onSubmitEditing={() => {
                  const t = newTagText.trim();
                  if (t && !userTags.includes(t)) {
                    dataService.addTag(t);
                    setUserTags(prev => [...prev, t]);
                    setTags(prev => [...prev, t]);
                  }
                  setNewTagText('');
                }}
              />
              <TouchableOpacity style={st.newTagBtn} onPress={() => {
                const t = newTagText.trim();
                if (t && !userTags.includes(t)) {
                  dataService.addTag(t);
                  setUserTags(prev => [...prev, t]);
                  setTags(prev => [...prev, t]);
                }
                setNewTagText('');
              }}>
                <Feather name="plus" size={16} color={colors.green} />
              </TouchableOpacity>
            </View>
          </View>

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
  tagsRow: { flexDirection: i18n.row(), flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tagChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: 'transparent' },
  tagTxt: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  newTagWrap: { flexDirection: i18n.row(), alignItems: 'center', backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.cardBorder, paddingStart: 10 },
  newTagInput: { color: colors.text, fontSize: 12, paddingVertical: 8, minWidth: 80, maxWidth: 120 },
  newTagBtn: { paddingHorizontal: 10, paddingVertical: 8 },
});
