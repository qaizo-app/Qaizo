// src/components/AddTransactionModal.js
// SwipeModal — свайп вниз закрывает, preselectedAccount, редактирование
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { accountTypeConfig, categoryConfig, colors } from '../theme/colors';
import DatePickerModal from './DatePickerModal';
import SwipeModal from './SwipeModal';

const EXP = ['food','restaurant','transport','fuel','health','phone','utilities','clothing','household','kids','entertainment','education','cosmetics','electronics','insurance','rent','arnona','vaad','other'];
const INC = ['salary_me','salary_spouse','rental_income','handyman','sales','other_income'];
const TAGS = ['👤 Alex','👩 Alexandra','👦 Sean','👧 Nicole','👨‍👩‍👧‍👦 Family'];

export default function AddTransactionModal({ visible, onClose, onSave, editTransaction, preselectedAccount }) {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('food');
  const [recipient, setRecipient] = useState('');
  const [note, setNote] = useState('');
  const [tags, setTags] = useState([]);
  const [dateStr, setDateStr] = useState('');
  const [showCal, setShowCal] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [selAcc, setSelAcc] = useState('');
  const [toAcc, setToAcc] = useState('');
  const [showMore, setShowMore] = useState(false);
  const isEdit = !!editTransaction;
  const lang = i18n.getLanguage();
  const hasPre = !!preselectedAccount;

  useEffect(() => {
    if (visible) {
      Promise.all([dataService.getAccounts(), dataService.getTransactions()]).then(([accs, txs]) => {
        const usage = {};
        txs.forEach(tx => { usage[tx.account] = (usage[tx.account]||0)+1; });
        let sorted = [...accs].filter(a => a.isActive !== false).sort((a, b) => (usage[b.id]||0) - (usage[a.id]||0));
        if (preselectedAccount) {
          const pre = sorted.find(a => a.id === preselectedAccount);
          if (pre) sorted = [pre, ...sorted.filter(a => a.id !== preselectedAccount)];
        }
        setAccounts(sorted);
        if (editTransaction) {
          setType(editTransaction.isTransfer ? 'transfer' : editTransaction.type);
          setAmount(String(editTransaction.amount));
          setCategoryId(editTransaction.categoryId || 'food');
          setRecipient(editTransaction.recipient || '');
          setNote(editTransaction.note || '');
          setTags(editTransaction.tags || []);
          setDateStr(editTransaction.date ? editTransaction.date.slice(0, 10) : '');
          setSelAcc(editTransaction.account || (sorted.length > 0 ? sorted[0].id : ''));
          setShowMore(!!(editTransaction.recipient || editTransaction.tags?.length));
        } else {
          setAmount(''); setRecipient(''); setNote(''); setTags([]);
          setType('expense'); setCategoryId('food'); setShowMore(false);
          const today = new Date();
          setDateStr(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`);
          if (preselectedAccount) setSelAcc(preselectedAccount);
          else if (sorted.length > 0) { setSelAcc(sorted[0].id); if (sorted.length > 1) setToAcc(sorted[1].id); }
        }
      });
    }
  }, [visible, editTransaction]);

  const cats = type === 'income' ? INC : EXP;
  const chgType = (t) => { setType(t); if (t === 'income') setCategoryId('salary_me'); else if (t === 'expense') setCategoryId('food'); };
  const togTag = (tag) => setTags(p => p.includes(tag) ? p.filter(t => t !== tag) : [...p, tag]);

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    const txDate = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();
    if (isEdit) {
      await dataService.updateTransaction(editTransaction.id, { type: type === 'transfer' ? editTransaction.type : type, amount: parseFloat(amount), categoryId, recipient, icon: categoryConfig[categoryId]?.icon || 'circle', note, tags, date: txDate, account: selAcc });
    } else if (type === 'transfer') {
      if (selAcc === toAcc) return;
      const fn = accounts.find(a => a.id === selAcc)?.name || '';
      const tn = accounts.find(a => a.id === toAcc)?.name || '';
      await dataService.addTransaction({ type: 'expense', amount: parseFloat(amount), categoryId: 'transfer', icon: 'repeat', recipient: tn, note: note || `→ ${tn}`, currency: '₪', date: txDate, account: selAcc, isTransfer: true, tags });
      await dataService.addTransaction({ type: 'income', amount: parseFloat(amount), categoryId: 'transfer', icon: 'repeat', recipient: fn, note: note || `← ${fn}`, currency: '₪', date: txDate, account: toAcc, isTransfer: true, tags });
    } else {
      await dataService.addTransaction({ type, amount: parseFloat(amount), categoryId, icon: categoryConfig[categoryId]?.icon || 'circle', recipient, note, currency: '₪', date: txDate, account: selAcc, tags });
    }
    onSave?.(); onClose?.();
  };

  const accLabel = type === 'expense' ? i18n.t('payFrom') : type === 'income' ? i18n.t('receiveTo') : i18n.t('from');
  const tc = type === 'expense' ? colors.red : type === 'income' ? colors.green : colors.blue;
  const title = isEdit ? i18n.t('edit') : i18n.t('add');
  const dd = dateStr ? (() => { const [y, m, d] = dateStr.split('-'); return `${d}.${m}.${y}`; })() : '';
  const getAI = (t) => (accountTypeConfig[t] || accountTypeConfig.bank).icon;

  return (
    <>
      <SwipeModal visible={visible} onClose={onClose}>
        {({ close }) => (
          <View>
            <Text style={st.title}>{title}</Text>

            <View style={st.typeRow}>
              {['expense', 'income', 'transfer'].map(t => {
                const a = type === t;
                const lb = t === 'expense' ? i18n.t('expenseType') : t === 'income' ? i18n.t('incomeType') : i18n.t('transfer');
                const ic = t === 'expense' ? 'arrow-up-right' : t === 'income' ? 'arrow-down-left' : 'repeat';
                const c = t === 'expense' ? colors.red : t === 'income' ? colors.green : colors.blue;
                return (
                  <TouchableOpacity key={t} style={[st.typeBtn, a && { backgroundColor: `${c}15`, borderWidth: 1, borderColor: `${c}40` }]}
                    onPress={() => !isEdit && chgType(t)} activeOpacity={isEdit ? 1 : 0.7}>
                    <Feather name={ic} size={16} color={a ? c : colors.textMuted} style={{ marginEnd: 4 }} />
                    <Text style={[st.typeTxt, a && { color: colors.text }]}>{lb}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={st.amtRow}>
              <Text style={[st.cur, { color: tc }]}>₪</Text>
              <TextInput style={st.amtIn} value={amount} onChangeText={setAmount} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
              <TouchableOpacity style={st.dateBtn} onPress={() => setShowCal(true)}>
                <Feather name="calendar" size={14} color={colors.green} />
                <Text style={st.dateTxt}>{dd || i18n.t('date')}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 260 }}>
              {!hasPre && type !== 'transfer' && (
                <>
                  <Text style={st.label}>{accLabel}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {accounts.map((acc, idx) => { const sl = selAcc === acc.id; return (
                      <TouchableOpacity key={acc.id} style={[st.chip, sl && { borderColor: tc, backgroundColor: `${tc}10` }]} onPress={() => setSelAcc(acc.id)}>
                        <MaterialCommunityIcons name={getAI(acc.type)} size={14} color={sl ? tc : colors.textMuted} />
                        <Text style={[st.chipTxt, sl && { color: colors.text }]} numberOfLines={1}>{acc.name}</Text>
                        {idx < 3 && <View style={[st.dot, { backgroundColor: tc }]} />}
                      </TouchableOpacity>); })}
                  </ScrollView>
                </>
              )}

              {type === 'transfer' && (
                <>
                  <Text style={st.label}>{i18n.t('from')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {accounts.map(acc => { const sl = selAcc === acc.id; return (
                      <TouchableOpacity key={acc.id} style={[st.chip, sl && { borderColor: tc, backgroundColor: `${tc}10` }]} onPress={() => setSelAcc(acc.id)}>
                        <MaterialCommunityIcons name={getAI(acc.type)} size={14} color={sl ? tc : colors.textMuted} />
                        <Text style={[st.chipTxt, sl && { color: colors.text }]} numberOfLines={1}>{acc.name}</Text>
                      </TouchableOpacity>); })}
                  </ScrollView>
                  <Text style={st.label}>{i18n.t('to')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {accounts.filter(a => a.id !== selAcc).map(acc => { const sl = toAcc === acc.id; return (
                      <TouchableOpacity key={acc.id} style={[st.chip, sl && { borderColor: colors.blue, backgroundColor: colors.blueSoft }]} onPress={() => setToAcc(acc.id)}>
                        <MaterialCommunityIcons name={getAI(acc.type)} size={14} color={sl ? colors.blue : colors.textMuted} />
                        <Text style={[st.chipTxt, sl && { color: colors.text }]} numberOfLines={1}>{acc.name}</Text>
                      </TouchableOpacity>); })}
                  </ScrollView>
                </>
              )}

              {type !== 'transfer' && (
                <>
                  <Text style={st.label}>{i18n.t('category')}</Text>
                  <View style={st.catGrid}>
                    {cats.map(cid => { const cfg = categoryConfig[cid] || categoryConfig.other; const sl = categoryId === cid; return (
                      <TouchableOpacity key={cid} style={[st.catBtn, sl && { borderColor: cfg.color, backgroundColor: `${cfg.color}12` }]} onPress={() => setCategoryId(cid)}>
                        <Feather name={cfg.icon} size={20} color={sl ? cfg.color : colors.textMuted} />
                        <Text style={[st.catLbl, sl && { color: cfg.color }]} numberOfLines={1}>{i18n.t(cid)}</Text>
                      </TouchableOpacity>); })}
                  </View>
                </>
              )}

              <TextInput style={st.input} value={recipient} onChangeText={setRecipient}
                placeholder={i18n.t('payee')} placeholderTextColor={colors.textMuted} />

              <TouchableOpacity style={st.moreBtn} onPress={() => setShowMore(!showMore)}>
                <Feather name={showMore ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textDim} />
                <Text style={st.moreTxt}>{showMore ? i18n.t('less') : i18n.t('more')}</Text>
              </TouchableOpacity>

              {showMore && (
                <>
                  <Text style={st.label}>{i18n.t('tags')}</Text>
                  <View style={st.tagsRow}>
                    {TAGS.map(tag => { const sl = tags.includes(tag); return (
                      <TouchableOpacity key={tag} style={[st.tagChip, sl && { borderColor: colors.green, backgroundColor: colors.greenSoft }]} onPress={() => togTag(tag)}>
                        <Text style={[st.tagTxt, sl && { color: colors.green }]}>{tag}</Text>
                      </TouchableOpacity>); })}
                  </View>
                  <TextInput style={[st.input, { height: 60, textAlignVertical: 'top' }]} value={note} onChangeText={setNote}
                    placeholder={i18n.t('note')} placeholderTextColor={colors.textMuted} multiline />
                </>
              )}
            </ScrollView>

            <View style={st.btnRow}>
              <TouchableOpacity style={st.cancelBtn} onPress={close}>
                <Text style={st.cancelTxt}>{i18n.t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.saveBtn, { backgroundColor: tc, opacity: amount && parseFloat(amount) > 0 ? 1 : 0.35 }]}
                onPress={handleSave} disabled={!amount || parseFloat(amount) <= 0}>
                <Feather name="check" size={18} color="#fff" style={{ marginEnd: 6 }} />
                <Text style={st.saveTxt}>{isEdit ? title : i18n.t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SwipeModal>
      <DatePickerModal visible={showCal} onClose={() => setShowCal(false)} onSelect={d => setDateStr(d)} selectedDate={dateStr} lang={lang} />
    </>
  );
}

const st = StyleSheet.create({
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 16 },
  typeRow: { flexDirection: 'row', marginBottom: 20, backgroundColor: colors.card, borderRadius: 14, padding: 4 },
  typeBtn: { flex: 1, flexDirection: 'row', paddingVertical: 12, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  typeTxt: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  amtRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  cur: { fontSize: 32, fontWeight: '800' },
  amtIn: { flex: 1, color: colors.text, fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  dateBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.cardBorder, gap: 6 },
  dateTxt: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  label: { color: colors.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.card, marginEnd: 8, borderWidth: 1.5, borderColor: 'transparent' },
  chipTxt: { color: colors.textDim, fontSize: 13, fontWeight: '500', marginStart: 6, maxWidth: 90 },
  dot: { width: 5, height: 5, borderRadius: 3, marginStart: 6, opacity: 0.6 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  catBtn: { width: '22%', alignItems: 'center', paddingVertical: 10, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1.5, borderColor: 'transparent', minWidth: 75 },
  catLbl: { color: colors.textMuted, fontSize: 9, fontWeight: '500', marginTop: 4 },
  input: { backgroundColor: colors.card, borderRadius: 14, padding: 14, color: colors.text, fontSize: 15, marginBottom: 10, borderWidth: 1, borderColor: colors.cardBorder },
  moreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, marginBottom: 8 },
  moreTxt: { color: colors.textDim, fontSize: 13, fontWeight: '600', marginStart: 4 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tagChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: 'transparent' },
  tagTxt: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 18, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  cancelTxt: { color: colors.textDim, fontSize: 16, fontWeight: '600' },
  saveBtn: { flex: 2, flexDirection: 'row', paddingVertical: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});