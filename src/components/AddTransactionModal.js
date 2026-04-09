// src/components/AddTransactionModal.js
// SwipeModal — свайп вниз закрывает, preselectedAccount, редактирование
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { accountTypeConfig, categoryConfig, colors } from '../theme/colors';
import { sym } from '../utils/currency';
import CategoryPickerModal, { getCatName, getCatIcon, DEFAULT_GROUPS } from './CategoryPickerModal';
import DatePickerModal from './DatePickerModal';
import CalculatorModal from './CalculatorModal';
import SwipeModal from './SwipeModal';

const INC = ['salary_me','salary_spouse','rental_income','handyman','sales','other_income'];
const EXP = Object.keys(categoryConfig).filter(k => !['salary_me','salary_spouse','rental_income','handyman','sales','other_income','transfer'].includes(k));

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
  const [userTags, setUserTags] = useState([]);
  const [newTagText, setNewTagText] = useState('');
  const [showCalc, setShowCalc] = useState(false);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [catGroups, setCatGroups] = useState(DEFAULT_GROUPS);
  const [projects, setProjects] = useState([]);
  const [selProject, setSelProject] = useState('');
  const [weekStart, setWeekStart] = useState('sunday');
  const [knownRecipients, setKnownRecipients] = useState([]);
  const [showRecipients, setShowRecipients] = useState(false);
  const isEdit = !!editTransaction;
  const lang = i18n.getLanguage();
  const hasPre = !!preselectedAccount;
  const st = createSt();

  useEffect(() => {
    if (visible) {
      dataService.getSettings().then(s => { if (s.weekStart) setWeekStart(s.weekStart); });
      dataService.getCategories().then(saved => { if (saved && saved.length > 0) setCatGroups(saved); });
      Promise.all([dataService.getAccounts(), dataService.getTransactions(), dataService.getTags(), dataService.getProjects()]).then(([accs, txs, savedTags, projs]) => {
        setProjects([...projs].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
        setUserTags(savedTags);
        // Collect unique recipients
        const recs = {};
        txs.forEach(tx => { if (tx.recipient) recs[tx.recipient] = (recs[tx.recipient]||0) + 1; });
        setKnownRecipients(Object.entries(recs).sort((a, b) => b[1] - a[1]).map(e => e[0]));
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
          setSelProject(editTransaction.projectId || '');
          setShowMore(!!(editTransaction.recipient || editTransaction.tags?.length || editTransaction.projectId));
        } else {
          setAmount(''); setRecipient(''); setNote(''); setTags([]); setSelProject('');
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
      const ci = getCatIcon(categoryId, catGroups);
      await dataService.updateTransaction(editTransaction.id, { type: type === 'transfer' ? editTransaction.type : type, amount: parseFloat(amount), categoryId, categoryName: getCatName(categoryId, catGroups, lang), recipient, icon: ci.icon, note, tags, date: txDate, account: selAcc, projectId: selProject || null });
    } else if (type === 'transfer') {
      if (selAcc === toAcc) return;
      const fn = accounts.find(a => a.id === selAcc)?.name || '';
      const tn = accounts.find(a => a.id === toAcc)?.name || '';
      const transferPairId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      await dataService.addTransaction({ type: 'expense', amount: parseFloat(amount), categoryId: 'transfer', icon: 'repeat', recipient: tn, note: note || `→ ${tn}`, currency: sym(), date: txDate, account: selAcc, isTransfer: true, transferPairId, tags });
      await dataService.addTransaction({ type: 'income', amount: parseFloat(amount), categoryId: 'transfer', icon: 'repeat', recipient: fn, note: note || `← ${fn}`, currency: sym(), date: txDate, account: toAcc, isTransfer: true, transferPairId, tags });
    } else {
      const ci2 = getCatIcon(categoryId, catGroups);
      await dataService.addTransaction({ type, amount: parseFloat(amount), categoryId, categoryName: getCatName(categoryId, catGroups, lang), icon: ci2.icon, recipient, note, currency: sym(), date: txDate, account: selAcc, tags, projectId: selProject || null });
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
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
              <Text style={[st.cur, { color: tc }]}>{sym()}</Text>
              <TextInput style={st.amtIn} value={amount} onChangeText={setAmount} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
              <TouchableOpacity style={st.calcBtn} onPress={() => setShowCalc(true)}>
                <MaterialCommunityIcons name="calculator-variant-outline" size={18} color={colors.textDim} />
              </TouchableOpacity>
              <TouchableOpacity style={st.dateBtn} onPress={() => setShowCal(true)}>
                <Feather name="calendar" size={14} color={colors.green} />
                <Text style={st.dateTxt}>{dd || i18n.t('date')}</Text>
              </TouchableOpacity>
            </View>

            <View>
              {!hasPre && type !== 'transfer' && (
                <>
                  <Text style={st.label}>{accLabel}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {accounts.filter(acc => type === 'income' ? ['cash', 'bank'].includes(acc.type) : ['cash', 'bank', 'credit'].includes(acc.type)).map((acc, idx) => { const sl = selAcc === acc.id; return (
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
                  {(() => { const ci = getCatIcon(categoryId, catGroups); return (
                  <TouchableOpacity style={st.catPickerBtn} onPress={() => setShowCatPicker(true)} activeOpacity={0.7}>
                    <View style={[st.catPickerIcon, { backgroundColor: ci.color + '18' }]}>
                      <Feather name={ci.icon} size={20} color={ci.color} />
                    </View>
                    <Text style={st.catPickerText}>{getCatName(categoryId, catGroups, lang)}</Text>
                    <Feather name="chevron-down" size={18} color={colors.textMuted} />
                  </TouchableOpacity>); })()}
                </>
              )}

              <TextInput style={st.input} value={recipient}
                onChangeText={(t) => { setRecipient(t); setShowRecipients(t.length > 0); }}
                onFocus={() => { if (recipient.length === 0 && knownRecipients.length > 0) setShowRecipients(true); }}
                onBlur={() => setTimeout(() => setShowRecipients(false), 200)}
                placeholder={i18n.t('payee')} placeholderTextColor={colors.textMuted} />
              {showRecipients && knownRecipients.filter(r => !recipient || r.toLowerCase().includes(recipient.toLowerCase())).length > 0 && (
                <View style={st.recipientList}>
                  {knownRecipients
                    .filter(r => !recipient || r.toLowerCase().includes(recipient.toLowerCase()))
                    .slice(0, 5)
                    .map(r => (
                      <TouchableOpacity key={r} style={st.recipientItem}
                        onPress={() => { setRecipient(r); setShowRecipients(false); }}>
                        <Text style={st.recipientText}>{r}</Text>
                      </TouchableOpacity>
                    ))}
                </View>
              )}

              {/* Project */}
              <Text style={st.label}>{i18n.t('project')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={st.tagsRow}>
                  {projects.map(p => {
                    const sel = selProject === p.id;
                    const pc = p.color || '#60a5fa';
                    return (
                      <TouchableOpacity key={p.id} style={[st.tagChip, sel && { borderColor: pc, backgroundColor: `${pc}15` }]}
                        onPress={() => setSelProject(sel ? '' : p.id)}>
                        <Feather name={p.icon || 'folder'} size={14} color={sel ? pc : colors.textMuted} style={{ marginEnd: 4 }} />
                        <Text style={[st.tagTxt, sel && { color: pc }]}>{p.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <TouchableOpacity style={st.moreBtn} onPress={() => setShowMore(!showMore)}>
                <Feather name={showMore ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textDim} />
                <Text style={st.moreTxt}>{showMore ? i18n.t('less') : i18n.t('more')}</Text>
              </TouchableOpacity>

              {showMore && (
                <>
                  <Text style={st.label}>{i18n.t('tags')}</Text>
                  <View style={st.tagsRow}>
                    {userTags.map((tag, idx) => {
                      const tagColors = ['#34d399','#60a5fa','#fb923c','#a78bfa','#f472b6','#fbbf24','#2dd4bf','#f87171'];
                      const tc = tagColors[idx % tagColors.length];
                      const sl = tags.includes(tag);
                      return (
                      <TouchableOpacity key={tag} style={[st.tagChip, sl && { borderColor: tc, backgroundColor: `${tc}15` }]}
                        onPress={() => togTag(tag)}
                        onLongPress={() => {
                          dataService.deleteTag(tag);
                          setUserTags(prev => prev.filter(t => t !== tag));
                          setTags(prev => prev.filter(t => t !== tag));
                        }}>
                        <Text style={[st.tagTxt, sl && { color: tc }]}>{tag}</Text>
                      </TouchableOpacity>); })}
                    {/* Добавить новый тег */}
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
                  <TextInput style={[st.input, { height: 60, textAlignVertical: 'top' }]} value={note} onChangeText={setNote}
                    placeholder={i18n.t('note')} placeholderTextColor={colors.textMuted} multiline />
                </>
              )}
            </View>

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
      <DatePickerModal visible={showCal} onClose={() => setShowCal(false)} onSelect={d => setDateStr(d)} selectedDate={dateStr} lang={lang} weekStart={weekStart} />
      <CategoryPickerModal visible={showCatPicker} onClose={() => setShowCatPicker(false)} onSelect={setCategoryId} type={type} />
      <CalculatorModal visible={showCalc} onClose={() => setShowCalc(false)} initialValue={amount}
        onResult={(val) => setAmount(val)} />
    </>
  );
}

const createSt = () => StyleSheet.create({
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 16, textAlign: i18n.textAlign() },
  typeRow: { flexDirection: i18n.row(), marginBottom: 20, backgroundColor: colors.card, borderRadius: 14, padding: 4 },
  typeBtn: { flex: 1, flexDirection: i18n.row(), paddingVertical: 12, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  typeTxt: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  amtRow: { flexDirection: i18n.row(), alignItems: 'center', marginBottom: 16, gap: 8, backgroundColor: colors.bg2, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.cardBorder },
  cur: { fontSize: 32, fontWeight: '800' },
  amtIn: { flex: 1, color: colors.text, fontSize: 32, fontWeight: '800', letterSpacing: -1, minWidth: 60 },
  calcBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  dateBtn: { flexDirection: i18n.row(), alignItems: 'center', backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: 10, minHeight: 34, borderWidth: 1, borderColor: colors.cardBorder, gap: 4 },
  dateTxt: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  label: { color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8, textAlign: i18n.textAlign() },
  chip: { flexDirection: i18n.row(), alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.card, marginEnd: 8, borderWidth: 1.5, borderColor: 'transparent' },
  chipTxt: { color: colors.textDim, fontSize: 12, fontWeight: '500', marginStart: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, marginStart: 6, opacity: 0.6 },
  catPickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.cardBorder, gap: 12 },
  catPickerIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  catPickerText: { color: colors.text, fontSize: 16, fontWeight: '600', flex: 1 },
  input: { backgroundColor: colors.card, borderRadius: 14, padding: 14, color: colors.text, fontSize: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.cardBorder, textAlign: i18n.textAlign() },
  recipientList: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, marginTop: -8, marginBottom: 10, overflow: 'hidden' },
  recipientItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  recipientText: { color: colors.text, fontSize: 14, fontWeight: '500' },
  moreBtn: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'center', paddingVertical: 8, marginBottom: 8 },
  moreTxt: { color: colors.textDim, fontSize: 12, fontWeight: '600', marginStart: 4 },
  tagsRow: { flexDirection: i18n.row(), flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tagChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: 'transparent' },
  tagTxt: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  newTagWrap: { flexDirection: i18n.row(), alignItems: 'center', backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.cardBorder, paddingStart: 10 },
  newTagInput: { color: colors.text, fontSize: 12, paddingVertical: 8, minWidth: 80, maxWidth: 120 },
  newTagBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  btnRow: { flexDirection: i18n.row(), gap: 12, marginTop: 8, paddingBottom: 8 },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  cancelTxt: { color: colors.textDim, fontSize: 16, fontWeight: '600' },
  saveBtn: { flex: 2, flexDirection: i18n.row(), paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});