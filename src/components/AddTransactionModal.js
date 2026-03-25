// src/components/AddTransactionModal.js
// Календарь для даты, MaterialCommunityIcons для счетов, получатель, теги
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { accountTypeConfig, categoryConfig, colors } from '../theme/colors';
import DatePickerModal from './DatePickerModal';

const EXPENSE_CATS = ['food','restaurant','transport','fuel','health','phone','utilities','clothing','household','kids','entertainment','education','cosmetics','electronics','insurance','rent','arnona','vaad','other'];
const INCOME_CATS = ['salary_me','salary_spouse','rental_income','handyman','sales','other_income'];
const FAMILY_TAGS = ['👤 Alex', '👩 Alexandra', '👦 Sean', '👧 Nicole', '👨‍👩‍👧‍👦 Family'];

export default function AddTransactionModal({ visible, onClose, onSave, editTransaction }) {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('food');
  const [recipient, setRecipient] = useState('');
  const [note, setNote] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [dateStr, setDateStr] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [showMore, setShowMore] = useState(false);
  const isEdit = !!editTransaction;
  const lang = i18n.getLanguage();

  useEffect(() => {
    if (visible) {
      Promise.all([dataService.getAccounts(), dataService.getTransactions()]).then(([accs, txs]) => {
        const usage = {};
        txs.forEach(tx => { usage[tx.account] = (usage[tx.account]||0)+1; });
        const sorted = [...accs].filter(a => a.isActive !== false).sort((a,b) => (usage[b.id]||0) - (usage[a.id]||0));
        setAccounts(sorted);
        if (editTransaction) {
          setType(editTransaction.isTransfer?'transfer':editTransaction.type);
          setAmount(String(editTransaction.amount));
          setCategoryId(editTransaction.categoryId||'food');
          setRecipient(editTransaction.recipient||'');
          setNote(editTransaction.note||'');
          setSelectedTags(editTransaction.tags||[]);
          setDateStr(editTransaction.date ? editTransaction.date.slice(0,10) : '');
          setSelectedAccount(editTransaction.account || (sorted.length>0?sorted[0].id:''));
          setShowMore(!!(editTransaction.recipient || editTransaction.tags?.length));
        } else {
          setAmount(''); setRecipient(''); setNote(''); setSelectedTags([]);
          setType('expense'); setCategoryId('food'); setShowMore(false);
          const today = new Date();
          setDateStr(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`);
          if (sorted.length>0) { setSelectedAccount(sorted[0].id); if(sorted.length>1) setToAccount(sorted[1].id); }
        }
      });
    }
  }, [visible, editTransaction]);

  const cats = type==='income' ? INCOME_CATS : EXPENSE_CATS;
  const handleTypeChange = (t) => { setType(t); if(t==='income') setCategoryId('salary_me'); else if(t==='expense') setCategoryId('food'); };
  const toggleTag = (tag) => { setSelectedTags(prev => prev.includes(tag) ? prev.filter(t=>t!==tag) : [...prev, tag]); };

  const handleSave = async () => {
    if (!amount || parseFloat(amount)<=0) return;
    const txDate = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();
    if (isEdit) {
      await dataService.updateTransaction(editTransaction.id, { type:type==='transfer'?editTransaction.type:type, amount:parseFloat(amount), categoryId, recipient, icon:categoryConfig[categoryId]?.icon||'circle', note, tags:selectedTags, date:txDate, account:selectedAccount });
    } else if (type==='transfer') {
      if (selectedAccount===toAccount) return;
      const fn = accounts.find(a=>a.id===selectedAccount)?.name||'';
      const tn = accounts.find(a=>a.id===toAccount)?.name||'';
      await dataService.addTransaction({ type:'expense', amount:parseFloat(amount), categoryId:'transfer', icon:'repeat', recipient:tn, note:note||`→ ${tn}`, currency:'₪', date:txDate, account:selectedAccount, isTransfer:true, tags:selectedTags });
      await dataService.addTransaction({ type:'income', amount:parseFloat(amount), categoryId:'transfer', icon:'repeat', recipient:fn, note:note||`← ${fn}`, currency:'₪', date:txDate, account:toAccount, isTransfer:true, tags:selectedTags });
    } else {
      await dataService.addTransaction({ type, amount:parseFloat(amount), categoryId, icon:categoryConfig[categoryId]?.icon||'circle', recipient, note, currency:'₪', date:txDate, account:selectedAccount, tags:selectedTags });
    }
    onSave?.(); onClose?.();
  };

  const accLabel = type==='expense'?(lang==='ru'?'Откуда списать':lang==='he'?'מאיפה':'Pay from'):type==='income'?(lang==='ru'?'Куда зачислить':lang==='he'?'לאן':'Receive to'):(lang==='ru'?'Откуда':lang==='he'?'מחשבון':'From');
  const typeColor = type==='expense'?colors.red:type==='income'?colors.green:colors.blue;
  const modalTitle = isEdit?(lang==='ru'?'Изменить':lang==='he'?'עריכה':'Edit'):(lang==='ru'?'Добавить':lang==='he'?'הוספה':'Add');

  const displayDate = dateStr ? (() => { const [y,m,d] = dateStr.split('-'); return `${d}.${m}.${y}`; })() : '';

  const getAccIcon = (accType) => {
    const cfg = accountTypeConfig[accType] || accountTypeConfig.bank;
    return cfg.icon;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS==='ios'?'padding':undefined}>
        <View style={styles.modal}>
          <View style={styles.handle} />
          <Text style={styles.modalTitle}>{modalTitle}</Text>

          {/* Type */}
          <View style={styles.typeRow}>
            {['expense','income','transfer'].map(t => {
              const active = type===t;
              const label = t==='expense'?i18n.t('expenseType'):t==='income'?i18n.t('incomeType'):i18n.t('transfer');
              const ic = t==='expense'?'arrow-up-right':t==='income'?'arrow-down-left':'repeat';
              const c = t==='expense'?colors.red:t==='income'?colors.green:colors.blue;
              return (
                <TouchableOpacity key={t} style={[styles.typeBtn, active&&{backgroundColor:`${c}15`, borderWidth:1, borderColor:`${c}40`}]} onPress={()=>!isEdit&&handleTypeChange(t)} activeOpacity={isEdit?1:0.7}>
                  <Feather name={ic} size={16} color={active?c:colors.textMuted} style={{marginRight:4}} />
                  <Text style={[styles.typeBtnText, active&&{color:colors.text}]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Amount + Date */}
          <View style={styles.amountDateRow}>
            <View style={styles.amountSection}>
              <Text style={[styles.currency, {color:typeColor}]}>₪</Text>
              <TextInput style={styles.amountInput} value={amount} onChangeText={setAmount} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" autoFocus={!isEdit} />
            </View>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowCalendar(true)}>
              <Feather name="calendar" size={16} color={colors.green} />
              <Text style={styles.dateBtnText}>{displayDate || (lang==='ru'?'Дата':'Date')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{maxHeight:300}}>
            {/* Account */}
            <Text style={styles.label}>{accLabel}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:12}}>
              {accounts.map((acc,idx) => {
                const sel = selectedAccount===acc.id;
                return (
                  <TouchableOpacity key={acc.id} style={[styles.chip, sel&&{borderColor:typeColor, backgroundColor:`${typeColor}10`}]} onPress={()=>setSelectedAccount(acc.id)}>
                    <MaterialCommunityIcons name={getAccIcon(acc.type)} size={14} color={sel?typeColor:colors.textMuted} />
                    <Text style={[styles.chipText, sel&&{color:colors.text}]} numberOfLines={1}>{acc.name}</Text>
                    {idx<3 && <View style={[styles.freqDot, {backgroundColor:typeColor}]} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* To (transfer) */}
            {type==='transfer'&&!isEdit&&(
              <>
                <Text style={styles.label}>{lang==='ru'?'Куда':lang==='he'?'לאן':'To'}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:12}}>
                  {accounts.filter(a=>a.id!==selectedAccount).map(acc => (
                    <TouchableOpacity key={acc.id} style={[styles.chip, toAccount===acc.id&&{borderColor:colors.blue, backgroundColor:colors.blueSoft}]} onPress={()=>setToAccount(acc.id)}>
                      <MaterialCommunityIcons name={getAccIcon(acc.type)} size={14} color={toAccount===acc.id?colors.blue:colors.textMuted} />
                      <Text style={[styles.chipText, toAccount===acc.id&&{color:colors.text}]} numberOfLines={1}>{acc.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Categories */}
            {type!=='transfer'&&(
              <>
                <Text style={styles.label}>{i18n.t('category')}</Text>
                <View style={styles.catGrid}>
                  {cats.map(catId => {
                    const cfg = categoryConfig[catId]||categoryConfig.other;
                    const sel = categoryId===catId;
                    return (
                      <TouchableOpacity key={catId} style={[styles.catBtn, sel&&{borderColor:cfg.color, backgroundColor:`${cfg.color}12`}]} onPress={()=>setCategoryId(catId)}>
                        <Feather name={cfg.icon} size={20} color={sel?cfg.color:colors.textMuted} />
                        <Text style={[styles.catLabel, sel&&{color:cfg.color}]} numberOfLines={1}>{i18n.t(catId)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* Recipient */}
            <TextInput style={styles.input} value={recipient} onChangeText={setRecipient}
              placeholder={lang==='ru'?'Получатель':lang==='he'?'מוטב':'Payee'} placeholderTextColor={colors.textMuted} />

            {/* More */}
            <TouchableOpacity style={styles.moreToggle} onPress={()=>setShowMore(!showMore)}>
              <Feather name={showMore?'chevron-up':'chevron-down'} size={16} color={colors.textDim} />
              <Text style={styles.moreText}>{showMore?(lang==='ru'?'Меньше':'Less'):(lang==='ru'?'Ещё поля':'More')}</Text>
            </TouchableOpacity>

            {showMore&&(
              <>
                <Text style={styles.label}>{lang==='ru'?'Теги':lang==='he'?'תגיות':'Tags'}</Text>
                <View style={styles.tagsRow}>
                  {FAMILY_TAGS.map(tag => {
                    const sel = selectedTags.includes(tag);
                    return (
                      <TouchableOpacity key={tag} style={[styles.tagChip, sel&&styles.tagActive]} onPress={()=>toggleTag(tag)}>
                        <Text style={[styles.tagText, sel&&{color:colors.green}]}>{tag}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TextInput style={[styles.input, {height:60, textAlignVertical:'top'}]} value={note} onChangeText={setNote} placeholder={i18n.t('note')} placeholderTextColor={colors.textMuted} multiline />
              </>
            )}
          </ScrollView>

          {/* Buttons */}
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>{i18n.t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, {backgroundColor:typeColor, opacity:amount&&parseFloat(amount)>0?1:0.35}]} onPress={handleSave} disabled={!amount||parseFloat(amount)<=0}>
              <Feather name="check" size={18} color="#fff" style={{marginRight:6}} />
              <Text style={styles.saveText}>{isEdit?modalTitle:i18n.t('save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Calendar */}
      <DatePickerModal visible={showCalendar} onClose={()=>setShowCalendar(false)}
        onSelect={(d) => setDateStr(d)} selectedDate={dateStr} lang={lang} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {flex:1, backgroundColor:colors.overlay, justifyContent:'flex-end'},
  modal: {backgroundColor:colors.bg2, borderTopLeftRadius:28, borderTopRightRadius:28, padding:24, paddingBottom:36, maxHeight:'92%'},
  handle: {width:40, height:4, borderRadius:2, backgroundColor:colors.textMuted, alignSelf:'center', marginBottom:16, opacity:0.4},
  modalTitle: {color:colors.text, fontSize:20, fontWeight:'700', marginBottom:16},
  typeRow: {flexDirection:'row', marginBottom:20, backgroundColor:colors.card, borderRadius:14, padding:4},
  typeBtn: {flex:1, flexDirection:'row', paddingVertical:12, borderRadius:11, alignItems:'center', justifyContent:'center'},
  typeBtnText: {color:colors.textMuted, fontSize:13, fontWeight:'600'},
  amountDateRow: {flexDirection:'row', alignItems:'center', marginBottom:16, gap:12},
  amountSection: {flex:1, flexDirection:'row', alignItems:'center'},
  currency: {fontSize:32, fontWeight:'800', marginRight:6},
  amountInput: {flex:1, color:colors.text, fontSize:36, fontWeight:'800', letterSpacing:-1},
  dateBtn: {flexDirection:'row', alignItems:'center', backgroundColor:colors.card, borderRadius:12, paddingHorizontal:14, paddingVertical:12, borderWidth:1, borderColor:colors.cardBorder, gap:6},
  dateBtnText: {color:colors.textDim, fontSize:13, fontWeight:'600'},
  label: {color:colors.textDim, fontSize:11, fontWeight:'700', letterSpacing:1, marginBottom:8},
  chip: {flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:10, borderRadius:12, backgroundColor:colors.card, marginRight:8, borderWidth:1.5, borderColor:'transparent'},
  chipText: {color:colors.textDim, fontSize:13, fontWeight:'500', marginLeft:6, maxWidth:90},
  freqDot: {width:5, height:5, borderRadius:3, marginLeft:6, opacity:0.6},
  catGrid: {flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:12},
  catBtn: {width:'22%', alignItems:'center', paddingVertical:10, borderRadius:14, backgroundColor:colors.card, borderWidth:1.5, borderColor:'transparent', minWidth:75},
  catLabel: {color:colors.textMuted, fontSize:9, fontWeight:'500', marginTop:4},
  input: {backgroundColor:colors.card, borderRadius:14, padding:14, color:colors.text, fontSize:15, marginBottom:10, borderWidth:1, borderColor:colors.cardBorder},
  moreToggle: {flexDirection:'row', alignItems:'center', justifyContent:'center', paddingVertical:8, marginBottom:8},
  moreText: {color:colors.textDim, fontSize:13, fontWeight:'600', marginLeft:4},
  tagsRow: {flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:12},
  tagChip: {paddingHorizontal:14, paddingVertical:8, borderRadius:10, backgroundColor:colors.card, borderWidth:1, borderColor:'transparent'},
  tagActive: {borderColor:colors.green, backgroundColor:colors.greenSoft},
  tagText: {color:colors.textMuted, fontSize:13, fontWeight:'500'},
  btnRow: {flexDirection:'row', gap:12, marginTop:8},
  cancelBtn: {flex:1, paddingVertical:18, borderRadius:14, backgroundColor:colors.card, alignItems:'center', borderWidth:1, borderColor:colors.cardBorder},
  cancelText: {color:colors.textDim, fontSize:16, fontWeight:'600'},
  saveBtn: {flex:2, flexDirection:'row', paddingVertical:18, borderRadius:14, alignItems:'center', justifyContent:'center'},
  saveText: {color:'#fff', fontSize:16, fontWeight:'700'},
});