// src/screens/AccountsScreen.js
// MaterialCommunityIcons для счетов, крипто-секция восстановлена
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Card from '../components/Card';
import ConfirmModal from '../components/ConfirmModal';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { accountTypeConfig, colors } from '../theme/colors';

const ACCOUNT_TYPES = [
  { id: 'bank' }, { id: 'credit' }, { id: 'cash' },
  { id: 'mortgage' }, { id: 'loan' }, { id: 'investment' }, { id: 'debt' },
];
const CURRENCIES = ['₪', '$', '€', '£', 'CZK'];

const typeLabel = (id, lang) => {
  const labels = {
    bank:       { ru:'Банк', he:'בנק', en:'Bank' },
    credit:     { ru:'Кредитка', he:'כרטיס אשראי', en:'Credit Card' },
    cash:       { ru:'Наличные', he:'מזומן', en:'Cash' },
    mortgage:   { ru:'Ипотека', he:'משכנתא', en:'Mortgage' },
    loan:       { ru:'Ссуда', he:'הלוואה', en:'Loan' },
    investment: { ru:'Инвестиции', he:'השקעות', en:'Investment' },
    debt:       { ru:'Долг', he:'חוב', en:'Debt' },
    crypto:     { ru:'Крипто', he:'קריפטו', en:'Crypto' },
  };
  return labels[id]?.[lang] || labels[id]?.en || id;
};

function AccIcon({ type, size = 18 }) {
  const cfg = accountTypeConfig[type] || accountTypeConfig.bank;
  const box = size + 26;
  return (
    <View style={{ width:box, height:box, borderRadius:box*0.3, backgroundColor:`${cfg.color}18`, justifyContent:'center', alignItems:'center' }}>
      <MaterialCommunityIcons name={cfg.icon} size={size} color={cfg.color} />
    </View>
  );
}

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState([]);
  const [showEdit, setShowEdit] = useState(false);
  const [editAccount, setEditAccount] = useState(null);
  const [name, setName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [type, setType] = useState('bank');
  const [currency, setCurrency] = useState('₪');
  const [balance, setBalance] = useState('0');
  const [overdraft, setOverdraft] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [, forceUpdate] = useState(0);

  const lang = i18n.getLanguage();
  const loadData = async () => { const accs = await dataService.getAccounts(); setAccounts(accs); forceUpdate(n => n + 1); };
  useFocusEffect(useCallback(() => { loadData(); }, []));

  const activeAccounts = accounts.filter(a => a.isActive !== false);
  const inactiveAccounts = accounts.filter(a => a.isActive === false);

  const grouped = {};
  ACCOUNT_TYPES.forEach(t => {
    const accs = activeAccounts.filter(a => a.type === t.id);
    if (accs.length > 0) grouped[t.id] = accs;
  });
  const totalBalance = activeAccounts.reduce((s, a) => s + (a.balance || 0), 0);

  const openEdit = (acc) => {
    setEditAccount(acc); setName(acc.name); setAccountNumber(acc.accountNumber || '');
    setType(acc.type || 'bank'); setCurrency(acc.currency || '₪');
    setBalance(String(acc.balance || 0)); setOverdraft(acc.overdraft ? String(acc.overdraft) : '');
    setIsActive(acc.isActive !== false); setShowEdit(true);
  };
  const openAdd = () => {
    setEditAccount(null); setName(''); setAccountNumber(''); setType('bank');
    setCurrency('₪'); setBalance('0'); setOverdraft(''); setIsActive(true); setShowEdit(true);
  };
  const handleSave = async () => {
    if (!name.trim()) return;
    const cfg = accountTypeConfig[type] || accountTypeConfig.bank;
    const data = { name:name.trim(), accountNumber:accountNumber.trim(), type, currency, balance:parseFloat(balance)||0, overdraft:overdraft?parseFloat(overdraft):null, isActive, icon:cfg.icon };
    if (editAccount) await dataService.updateAccount(editAccount.id, data);
    else await dataService.addAccount(data);
    setShowEdit(false); await loadData();
  };
  const handleDelete = async () => {
    if (deleteTarget) { await dataService.deleteAccount(deleteTarget.id); setDeleteTarget(null); setShowEdit(false); await loadData(); }
  };

  const tc = accountTypeConfig[type]?.color || '#60a5fa';

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.header}>
          <Text style={styles.title}>{i18n.t('accounts')}</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Feather name="plus" size={20} color={colors.bg} />
          </TouchableOpacity>
        </View>

        <Card highlighted>
          <Text style={styles.totalLabel}>{i18n.t('totalAssets')}</Text>
          <Text style={[styles.totalAmount, { color: totalBalance >= 0 ? colors.text : colors.red }]}>₪ {totalBalance.toLocaleString()}</Text>
        </Card>

        {/* Account groups */}
        {Object.entries(grouped).map(([typeId, accs]) => {
          const cfg = accountTypeConfig[typeId];
          const groupSum = accs.reduce((s, a) => s + (a.balance || 0), 0);
          return (
            <View key={typeId}>
              <View style={styles.groupHeader}>
                <View style={[styles.groupIcon, { backgroundColor: `${cfg.color}18` }]}>
                  <MaterialCommunityIcons name={cfg.icon} size={14} color={cfg.color} />
                </View>
                <Text style={styles.groupTitle}>{typeLabel(typeId, lang)}</Text>
                <Text style={[styles.groupSum, { color: groupSum >= 0 ? colors.textDim : colors.red }]}>₪{groupSum.toLocaleString()}</Text>
              </View>
              {accs.map(acc => (
                <Card key={acc.id}>
                  <TouchableOpacity style={styles.accRow} onPress={() => openEdit(acc)}>
                    <AccIcon type={acc.type} />
                    <View style={styles.accInfo}>
                      <Text style={styles.accName}>{acc.name}</Text>
                      <Text style={styles.accSub}>
                        {acc.accountNumber ? `${acc.accountNumber} · ` : ''}{typeLabel(acc.type, lang)}
                        {acc.overdraft ? ` · ${lang==='ru'?'Лимит':'Limit'}: ${acc.currency}${acc.overdraft}` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.accBalance, { color: (acc.balance||0) >= 0 ? colors.text : colors.red }]}>
                      {acc.currency||'₪'} {(acc.balance||0).toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                </Card>
              ))}
            </View>
          );
        })}

        {/* Crypto placeholder */}
        <View style={styles.groupHeader}>
          <View style={[styles.groupIcon, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
            <MaterialCommunityIcons name="bitcoin" size={14} color="#f59e0b" />
          </View>
          <Text style={styles.groupTitle}>{typeLabel('crypto', lang)}</Text>
        </View>
        <Card>
          <TouchableOpacity style={[styles.accRow, { opacity: 0.6 }]}>
            <AccIcon type="crypto" />
            <View style={styles.accInfo}>
              <Text style={[styles.accName, { color: colors.textDim }]}>
                {lang==='ru'?'Скоро':lang==='he'?'בקרוב':'Coming soon'}
              </Text>
              <Text style={styles.accSub}>Bitcoin, Ethereum, USDT...</Text>
            </View>
            <View style={styles.v2Badge}><Text style={styles.v2Text}>v2</Text></View>
          </TouchableOpacity>
        </Card>

        {/* Inactive */}
        {inactiveAccounts.length > 0 && (
          <View>
            <View style={styles.groupHeader}>
              <View style={[styles.groupIcon, { backgroundColor: 'rgba(100,116,139,0.12)' }]}>
                <Feather name="archive" size={14} color={colors.textMuted} />
              </View>
              <Text style={styles.groupTitle}>{lang==='ru'?'Неактивные':lang==='he'?'לא פעילים':'Inactive'}</Text>
            </View>
            {inactiveAccounts.map(acc => (
              <Card key={acc.id}>
                <TouchableOpacity style={[styles.accRow, { opacity: 0.4 }]} onPress={() => openEdit(acc)}>
                  <AccIcon type={acc.type} />
                  <View style={styles.accInfo}><Text style={styles.accName}>{acc.name}</Text></View>
                  <Text style={[styles.accBalance, { color: colors.textMuted }]}>{acc.currency||'₪'} {(acc.balance||0).toLocaleString()}</Text>
                </TouchableOpacity>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal */}
      <Modal visible={showEdit} animationType="slide" transparent>
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={{ justifyContent:'flex-end', flexGrow:1 }}>
            <View style={styles.modal}>
              <View style={styles.handleBar} />
              <Text style={styles.modalTitle}>{editAccount ? editAccount.name : (lang==='ru'?'Новый счёт':lang==='he'?'חשבון חדש':'New Account')}</Text>

              <Text style={styles.fieldLabel}>{lang==='ru'?'Тип':lang==='he'?'סוג':'Type'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:16 }}>
                {ACCOUNT_TYPES.map(t => {
                  const cfg = accountTypeConfig[t.id];
                  return (
                    <TouchableOpacity key={t.id} style={[styles.typeChip, type===t.id && {borderColor:cfg.color, backgroundColor:`${cfg.color}12`}]} onPress={()=>setType(t.id)}>
                      <MaterialCommunityIcons name={cfg.icon} size={16} color={type===t.id ? cfg.color : colors.textMuted} />
                      <Text style={[styles.typeChipText, type===t.id && {color:cfg.color}]}>{typeLabel(t.id, lang)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.fieldLabel}>{lang==='ru'?'Название':lang==='he'?'שם':'Name'}</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Mizrahi, Visa 3324..." placeholderTextColor={colors.textMuted} />

              <Text style={styles.fieldLabel}>{lang==='ru'?'Номер (не обязательно)':lang==='he'?'מספר (לא חובה)':'Number (optional)'}</Text>
              <TextInput style={styles.input} value={accountNumber} onChangeText={setAccountNumber} placeholder="1234" placeholderTextColor={colors.textMuted} />

              <Text style={styles.fieldLabel}>{i18n.t('currency')}</Text>
              <View style={styles.currencyRow}>
                {CURRENCIES.map(c => (
                  <TouchableOpacity key={c} style={[styles.currencyBtn, currency===c && {borderColor:tc, backgroundColor:`${tc}12`}]} onPress={()=>setCurrency(c)}>
                    <Text style={[styles.currencyText, currency===c && {color:tc}]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>{lang==='ru'?'Баланс':lang==='he'?'יתרה':'Balance'}</Text>
              <View style={styles.balanceRow}>
                <Text style={[styles.balanceCurrency, {color:tc}]}>{currency}</Text>
                <TextInput style={styles.balanceInput} value={balance} onChangeText={setBalance} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textMuted} />
              </View>

              {(type==='bank'||type==='credit') && (
                <>
                  <Text style={styles.fieldLabel}>{type==='credit'?(lang==='ru'?'Мисгерет':lang==='he'?'מסגרת':'Limit'):(lang==='ru'?'Овердрафт':lang==='he'?'אוברדרפט':'Overdraft')}</Text>
                  <TextInput style={styles.input} value={overdraft} onChangeText={setOverdraft} keyboardType="numeric" placeholder="10000" placeholderTextColor={colors.textMuted} />
                </>
              )}

              <View style={styles.toggleRow}>
                <View>
                  <Text style={styles.toggleLabel}>{lang==='ru'?'Активный':lang==='he'?'פעיל':'Active'}</Text>
                  <Text style={styles.toggleSub}>{lang==='ru'?'Неактивные скрыты из списков':lang==='he'?'לא פעילים מוסתרים':'Inactive hidden'}</Text>
                </View>
                <Switch value={isActive} onValueChange={setIsActive} trackColor={{false:colors.card, true:`${tc}40`}} thumbColor={isActive?tc:colors.textMuted} />
              </View>

              <View style={styles.btnRow}>
                {editAccount && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={()=>setDeleteTarget(editAccount)}>
                    <Feather name="trash-2" size={20} color={colors.red} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.cancelBtn} onPress={()=>setShowEdit(false)}>
                  <Text style={styles.cancelText}>{i18n.t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, {backgroundColor:tc}]} onPress={handleSave}>
                  <Feather name="check" size={18} color="#fff" style={{marginRight:4}} />
                  <Text style={styles.saveText}>{i18n.t('save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <ConfirmModal visible={!!deleteTarget} title={i18n.t('delete')} message={deleteTarget?.name||''} confirmText={i18n.t('delete')} cancelText={i18n.t('cancel')} onConfirm={handleDelete} onCancel={()=>setDeleteTarget(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex:1, backgroundColor:colors.bg},
  header: {flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:24, paddingTop:60, paddingBottom:16},
  title: {color:colors.text, fontSize:24, fontWeight:'800'},
  addBtn: {width:44, height:44, borderRadius:14, backgroundColor:colors.green, justifyContent:'center', alignItems:'center'},
  totalLabel: {color:colors.textDim, fontSize:13, marginBottom:8},
  totalAmount: {fontSize:32, fontWeight:'800'},
  groupHeader: {flexDirection:'row', alignItems:'center', paddingHorizontal:24, marginTop:24, marginBottom:8},
  groupIcon: {width:28, height:28, borderRadius:8, justifyContent:'center', alignItems:'center', marginRight:8},
  groupTitle: {color:colors.textDim, fontSize:12, fontWeight:'700', letterSpacing:1, textTransform:'uppercase', flex:1},
  groupSum: {fontSize:13, fontWeight:'600'},
  accRow: {flexDirection:'row', alignItems:'center'},
  accInfo: {flex:1, marginLeft:14},
  accName: {color:colors.text, fontSize:16, fontWeight:'600'},
  accSub: {color:colors.textMuted, fontSize:11, marginTop:3},
  accBalance: {fontSize:17, fontWeight:'700'},
  v2Badge: {backgroundColor:'rgba(245,158,11,0.15)', paddingHorizontal:10, paddingVertical:4, borderRadius:8},
  v2Text: {color:'#f59e0b', fontSize:11, fontWeight:'700'},
  overlay: {flex:1, backgroundColor:colors.overlay},
  modal: {backgroundColor:colors.bg2, borderTopLeftRadius:28, borderTopRightRadius:28, padding:24, paddingBottom:40},
  handleBar: {width:40, height:4, borderRadius:2, backgroundColor:colors.textMuted, alignSelf:'center', marginBottom:20, opacity:0.4},
  modalTitle: {color:colors.text, fontSize:20, fontWeight:'700', marginBottom:20},
  fieldLabel: {color:colors.textDim, fontSize:11, fontWeight:'700', letterSpacing:0.5, marginBottom:6, marginTop:4},
  input: {backgroundColor:colors.card, borderRadius:14, padding:14, color:colors.text, fontSize:16, marginBottom:12, borderWidth:1, borderColor:colors.cardBorder},
  typeChip: {flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:10, borderRadius:12, backgroundColor:colors.card, marginRight:8, borderWidth:1.5, borderColor:'transparent'},
  typeChipText: {color:colors.textMuted, fontSize:12, fontWeight:'600', marginLeft:6},
  currencyRow: {flexDirection:'row', gap:8, marginBottom:16},
  currencyBtn: {paddingHorizontal:18, paddingVertical:10, borderRadius:12, backgroundColor:colors.card, borderWidth:1.5, borderColor:'transparent'},
  currencyText: {color:colors.textMuted, fontSize:16, fontWeight:'700'},
  balanceRow: {flexDirection:'row', alignItems:'center', marginBottom:16},
  balanceCurrency: {fontSize:28, fontWeight:'700', marginRight:8},
  balanceInput: {flex:1, color:colors.text, fontSize:28, fontWeight:'700'},
  toggleRow: {flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:16, marginBottom:8, borderTopWidth:1, borderTopColor:colors.divider},
  toggleLabel: {color:colors.text, fontSize:15, fontWeight:'600'},
  toggleSub: {color:colors.textMuted, fontSize:11, marginTop:2},
  btnRow: {flexDirection:'row', gap:10, marginTop:8},
  deleteBtn: {width:54, paddingVertical:16, borderRadius:14, backgroundColor:colors.redSoft, alignItems:'center', justifyContent:'center'},
  cancelBtn: {flex:1, paddingVertical:16, borderRadius:14, backgroundColor:colors.card, alignItems:'center', borderWidth:1, borderColor:colors.cardBorder},
  cancelText: {color:colors.textDim, fontSize:16, fontWeight:'600'},
  saveBtn: {flex:2, flexDirection:'row', paddingVertical:16, borderRadius:14, alignItems:'center', justifyContent:'center'},
  saveText: {color:'#fff', fontSize:16, fontWeight:'700'},
});