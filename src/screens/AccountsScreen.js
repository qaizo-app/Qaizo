// src/screens/AccountsScreen.js
// Плитки 2-3 в ряд, цветные по типу, группировка, свайп-модалка
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ConfirmModal from '../components/ConfirmModal';
import SwipeModal from '../components/SwipeModal';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { accountTypeConfig, colors } from '../theme/colors';
import { CURRENCIES, sym } from '../utils/currency';

const { width: SCREEN_W } = Dimensions.get('window');
const TILE_GAP = 10;
const TILE_W = (SCREEN_W - 48 - TILE_GAP * 2) / 3;

const ACCOUNT_TYPES = [
  { id:'bank' },{ id:'credit' },{ id:'cash' },{ id:'mortgage' },
  { id:'loan' },{ id:'investment' },{ id:'debt' },
];
const CURRENCY_SYMBOLS = CURRENCIES.map(c => c.symbol);
const typeLabel = (id) => i18n.t(id);

// Порядок групп: самые ходовые сверху
const GROUP_ORDER = ['cash','bank','credit','investment','loan','mortgage','debt'];

export default function AccountsScreen() {
  const navigation = useNavigation();
  const [accounts, setAccounts] = useState([]);
  const [showEdit, setShowEdit] = useState(false);
  const [editAccount, setEditAccount] = useState(null);
  const [name, setName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [type, setType] = useState('bank');
  const [currency, setCurrency] = useState(sym());
  const [balance, setBalance] = useState('0');
  const [overdraft, setOverdraft] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const styles = createStyles();

  const loadData = async () => { setAccounts(await dataService.getAccounts()); };
  useFocusEffect(useCallback(() => { loadData(); }, []));

  const active = accounts.filter(a => a.isActive !== false);
  const inactive = accounts.filter(a => a.isActive === false);
  const totalBalance = active.reduce((s,a) => s + (a.balance||0), 0);

  // Группировка по порядку
  const grouped = [];
  GROUP_ORDER.forEach(typeId => {
    const accs = active.filter(a => a.type === typeId);
    if (accs.length > 0) grouped.push({ typeId, accs, sum: accs.reduce((s,a) => s+(a.balance||0), 0) });
  });
  // Остальные типы
  const coveredTypes = new Set(GROUP_ORDER);
  active.filter(a => !coveredTypes.has(a.type)).forEach(a => {
    const existing = grouped.find(g => g.typeId === a.type);
    if (existing) existing.accs.push(a);
    else grouped.push({ typeId: a.type, accs: [a], sum: a.balance || 0 });
  });

  const openHistory = (acc) => navigation.navigate('AccountHistory', { account: acc });
  const openEdit = (acc) => {
    setEditAccount(acc); setName(acc.name); setAccountNumber(acc.accountNumber||'');
    setType(acc.type||'bank'); setCurrency(acc.currency||sym()); setBalance(String(acc.balance||0));
    setOverdraft(acc.overdraft ? String(acc.overdraft) : ''); setIsActive(acc.isActive!==false); setShowEdit(true);
  };
  const openAdd = () => {
    setEditAccount(null); setName(''); setAccountNumber(''); setType('bank');
    setCurrency(sym()); setBalance('0'); setOverdraft(''); setIsActive(true); setShowEdit(true);
  };
  const handleSave = async () => {
    if (!name.trim()) return;
    const cfg = accountTypeConfig[type]||accountTypeConfig.bank;
    const data = { name:name.trim(), accountNumber:accountNumber.trim(), type, currency, balance:parseFloat(balance)||0, overdraft:overdraft?parseFloat(overdraft):null, isActive, icon:cfg.icon };
    if (editAccount) await dataService.updateAccount(editAccount.id, data);
    else await dataService.addAccount(data);
    setShowEdit(false); await loadData();
  };
  const handleDelete = async () => {
    if (deleteTarget) { await dataService.deleteAccount(deleteTarget.id); setDeleteTarget(null); setShowEdit(false); await loadData(); }
  };

  const tc = accountTypeConfig[type]?.color || '#60a5fa';

  const renderTile = (acc) => {
    const cfg = accountTypeConfig[acc.type] || accountTypeConfig.bank;
    const bal = acc.balance || 0;
    return (
      <TouchableOpacity key={acc.id} style={[styles.tile, i18n.isRTL() ? { borderRightColor: cfg.color, borderRightWidth: 3 } : { borderLeftColor: cfg.color, borderLeftWidth: 3 }]}
        onPress={() => openHistory(acc)} onLongPress={() => openEdit(acc)} activeOpacity={0.7}>
        <View style={styles.tileTop}>
          <MaterialCommunityIcons name={cfg.icon} size={16} color={cfg.color} />
        </View>
        <Text style={styles.tileName} numberOfLines={1}>{acc.name}</Text>
        <Text style={[styles.tileBalance, { color: bal >= 0 ? colors.text : colors.red }]}>
          {bal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {acc.currency||sym()}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{i18n.t('accounts')}</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Feather name="plus" size={20} color={colors.bg} />
          </TouchableOpacity>
        </View>

        {/* Total */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>{i18n.t('totalAssets')}</Text>
          <Text style={[styles.totalAmount, { color: totalBalance >= 0 ? colors.text : colors.red }]}>{totalBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()}</Text>
        </View>

        {/* Hint */}
        <Text style={styles.hint}>
          {i18n.t('accountHint')}
        </Text>

        {/* Groups */}
        {grouped.map(({ typeId, accs, sum }) => {
          const cfg = accountTypeConfig[typeId] || accountTypeConfig.bank;
          return (
            <View key={typeId}>
              <View style={styles.groupHeader}>
                <MaterialCommunityIcons name={cfg.icon} size={14} color={cfg.color} style={{ }} />
                <Text style={[styles.groupTitle, { color: cfg.color }]}>{typeLabel(typeId)}</Text>
                <Text style={[styles.groupSum, { color: sum >= 0 ? colors.textDim : colors.red }]}>{sum.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()}</Text>
              </View>
              <View style={styles.tilesRow}>
                {accs.map(renderTile)}
              </View>
            </View>
          );
        })}

        {/* Crypto */}
        <View style={styles.groupHeader}>
          <MaterialCommunityIcons name="bitcoin" size={14} color="#f59e0b" style={{ }} />
          <Text style={[styles.groupTitle, { color: '#f59e0b' }]}>{typeLabel('crypto')}</Text>
          <View style={styles.v2Badge}><Text style={styles.v2Text}>v2</Text></View>
        </View>
        <View style={styles.tilesRow}>
          <View style={[styles.tile, { borderLeftColor: '#f59e0b', borderLeftWidth: 3, opacity: 0.4 }]}>
            <MaterialCommunityIcons name="bitcoin" size={16} color="#f59e0b" />
            <Text style={[styles.tileName, { color: colors.textMuted }]}>{i18n.t('comingSoon')}</Text>
            <Text style={[styles.tileBalance, { color: colors.textMuted }]}>—</Text>
          </View>
        </View>

        {/* Inactive */}
        {inactive.length > 0 && (
          <View>
            <View style={styles.groupHeader}>
              <Feather name="archive" size={14} color={colors.textMuted} style={{ }} />
              <Text style={styles.groupTitle}>{i18n.t('inactive')}</Text>
            </View>
            <View style={styles.tilesRow}>
              {inactive.map(acc => (
                <TouchableOpacity key={acc.id} style={[styles.tile, { opacity: 0.35 }, i18n.isRTL() ? { borderRightColor: colors.textMuted, borderRightWidth: 3 } : { borderLeftColor: colors.textMuted, borderLeftWidth: 3 }]}
                  onLongPress={() => openEdit(acc)}>
                  <Text style={styles.tileName} numberOfLines={1}>{acc.name}</Text>
                  <Text style={[styles.tileBalance, { color: colors.textMuted }]}>{(acc.balance||0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {acc.currency||sym()}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Edit/Add */}
      <SwipeModal visible={showEdit} onClose={() => setShowEdit(false)}>
        {({ close }) => (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{editAccount ? editAccount.name : (i18n.t('newAccount'))}</Text>

            <Text style={styles.fieldLabel}>{i18n.t('type')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:16 }}>
              {ACCOUNT_TYPES.map(t => {
                const cfg = accountTypeConfig[t.id];
                return (
                  <TouchableOpacity key={t.id} style={[styles.typeChip, type===t.id && {borderColor:cfg.color, backgroundColor:`${cfg.color}12`}]} onPress={()=>setType(t.id)}>
                    <MaterialCommunityIcons name={cfg.icon} size={16} color={type===t.id?cfg.color:colors.textMuted} />
                    <Text style={[styles.typeChipText, type===t.id&&{color:cfg.color}]}>{typeLabel(t.id)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.fieldLabel}>{i18n.t('name')}</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Mizrahi, Visa 3324..." placeholderTextColor={colors.textMuted} />

            <Text style={styles.fieldLabel}>{i18n.t('number')}</Text>
            <TextInput style={styles.input} value={accountNumber} onChangeText={setAccountNumber} placeholder="1234" placeholderTextColor={colors.textMuted} />

            <Text style={styles.fieldLabel}>{i18n.t('currency')}</Text>
            <View style={styles.currRow}>
              {CURRENCY_SYMBOLS.map(c => (
                <TouchableOpacity key={c} style={[styles.currBtn, currency===c&&{borderColor:tc,backgroundColor:`${tc}12`}]} onPress={()=>setCurrency(c)}>
                  <Text style={[styles.currText, currency===c&&{color:tc}]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>{i18n.t('balance')}</Text>
            <View style={styles.balRow}>
              <Text style={[styles.balCur,{color:tc}]}>{currency}</Text>
              <TextInput style={styles.balInput} value={balance} onChangeText={setBalance} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textMuted} />
            </View>

            {(type==='bank'||type==='credit')&&(
              <>
                <Text style={styles.fieldLabel}>{type==='credit'?i18n.t('creditLimit'):i18n.t('overdraft')}</Text>
                <TextInput style={styles.input} value={overdraft} onChangeText={setOverdraft} keyboardType="numeric" placeholder="10000" placeholderTextColor={colors.textMuted} />
              </>
            )}

            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleLabel}>{i18n.t('active')}</Text>
                <Text style={styles.toggleSub}>{i18n.t('hiddenWhenOff')}</Text>
              </View>
              <Switch value={isActive} onValueChange={setIsActive} trackColor={{false:colors.card,true:`${tc}40`}} thumbColor={isActive?tc:colors.textMuted} />
            </View>

            <View style={styles.btnRow}>
              {editAccount&&(<TouchableOpacity style={styles.delBtn} onPress={()=>setDeleteTarget(editAccount)}><Feather name="trash-2" size={20} color={colors.red} /></TouchableOpacity>)}
              <TouchableOpacity style={styles.cancelBtn} onPress={close}><Text style={styles.cancelText}>{i18n.t('cancel')}</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn,{backgroundColor:tc,opacity:name.trim()?1:0.35}]} onPress={handleSave} disabled={!name.trim()}><Feather name="check" size={18} color="#fff" /><Text style={styles.saveText}> {i18n.t('save')}</Text></TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </SwipeModal>

      <ConfirmModal visible={!!deleteTarget} title={i18n.t('delete')} message={deleteTarget?.name||''} confirmText={i18n.t('delete')} cancelText={i18n.t('cancel')} onConfirm={handleDelete} onCancel={()=>setDeleteTarget(null)} />
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  container:{flex:1,backgroundColor:colors.bg},
  header:{flexDirection:i18n.row(),justifyContent:'space-between',alignItems:'center',paddingHorizontal:24,paddingTop:60,paddingBottom:12},
  title:{color:colors.text,fontSize:24,fontWeight:'800',textAlign:i18n.textAlign()},
  addBtn:{width:44,height:44,borderRadius:14,backgroundColor:colors.green,justifyContent:'center',alignItems:'center'},

  totalCard:{marginHorizontal:24,marginBottom:8,backgroundColor:colors.card,borderRadius:20,padding:20,borderWidth:1,borderColor:'rgba(52,211,153,0.15)'},
  totalLabel:{color:colors.textDim,fontSize:13,marginBottom:6,textAlign:i18n.textAlign()},
  totalAmount:{fontSize:32,fontWeight:'800',textAlign:i18n.textAlign()},

  hint:{color:colors.textMuted,fontSize:11,textAlign:'center',marginBottom:12,opacity:0.5},

  groupHeader:{flexDirection:i18n.row(),alignItems:'center',paddingHorizontal:24,marginTop:20,marginBottom:8,gap:6},
  groupTitle:{color:colors.textDim,fontSize:12,fontWeight:'700',letterSpacing:1,textTransform:'uppercase',flex:1,textAlign:i18n.textAlign()},
  groupSum:{fontSize:13,fontWeight:'600'},

  tilesRow:{flexDirection:i18n.row(),flexWrap:'wrap',paddingHorizontal:24,gap:TILE_GAP},
  tile:{width:TILE_W,backgroundColor:colors.card,borderRadius:14,padding:12,borderWidth:1,borderColor:colors.cardBorder,marginBottom:TILE_GAP},
  tileTop:{marginBottom:6,alignItems:i18n.isRTL()?'flex-end':'flex-start'},
  tileName:{color:colors.textSecondary,fontSize:12,fontWeight:'600',marginBottom:4,textAlign:i18n.textAlign()},
  tileBalance:{color:colors.text,fontSize:15,fontWeight:'700',textAlign:i18n.textAlign()},

  v2Badge:{backgroundColor:'rgba(245,158,11,0.15)',paddingHorizontal:8,paddingVertical:2,borderRadius:6},
  v2Text:{color:'#f59e0b',fontSize:10,fontWeight:'700'},

  modalTitle:{color:colors.text,fontSize:20,fontWeight:'700',marginBottom:20,textAlign:i18n.textAlign()},
  fieldLabel:{color:colors.textDim,fontSize:11,fontWeight:'700',letterSpacing:0.5,marginBottom:6,marginTop:4},
  input:{backgroundColor:colors.card,borderRadius:14,padding:14,color:colors.text,fontSize:16,marginBottom:12,borderWidth:1,borderColor:colors.cardBorder},
  typeChip:{flexDirection:i18n.row(),alignItems:'center',paddingHorizontal:14,paddingVertical:10,borderRadius:12,backgroundColor:colors.card,marginEnd:8,borderWidth:1.5,borderColor:'transparent'},
  typeChipText:{color:colors.textMuted,fontSize:12,fontWeight:'600',marginStart:6},
  currRow:{flexDirection:i18n.row(),gap:8,marginBottom:16},
  currBtn:{paddingHorizontal:18,paddingVertical:10,borderRadius:12,backgroundColor:colors.card,borderWidth:1.5,borderColor:'transparent'},
  currText:{color:colors.textMuted,fontSize:16,fontWeight:'700'},
  balRow:{flexDirection:i18n.row(),alignItems:'center',marginBottom:16},
  balCur:{fontSize:28,fontWeight:'700',marginEnd:8},
  balInput:{flex:1,color:colors.text,fontSize:28,fontWeight:'700'},
  toggleRow:{flexDirection:i18n.row(),justifyContent:'space-between',alignItems:'center',paddingVertical:16,marginBottom:8,borderTopWidth:1,borderTopColor:colors.divider},
  toggleLabel:{color:colors.text,fontSize:15,fontWeight:'600'},
  toggleSub:{color:colors.textMuted,fontSize:11,marginTop:2},
  btnRow:{flexDirection:i18n.row(),gap:10,marginTop:8},
  delBtn:{width:54,paddingVertical:16,borderRadius:14,backgroundColor:colors.redSoft,alignItems:'center',justifyContent:'center'},
  cancelBtn:{flex:1,paddingVertical:16,borderRadius:14,backgroundColor:colors.card,alignItems:'center',borderWidth:1,borderColor:colors.cardBorder},
  cancelText:{color:colors.textDim,fontSize:16,fontWeight:'600'},
  saveBtn:{flex:2,flexDirection:i18n.row(),paddingVertical:16,borderRadius:14,alignItems:'center',justifyContent:'center'},
  saveText:{color:'#fff',fontSize:16,fontWeight:'700'},
});