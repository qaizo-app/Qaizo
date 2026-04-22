// src/screens/AccountsScreen.js
// Плитки 2-3 в ряд, цветные по типу, группировка, свайп-модалка
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Dimensions, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Amount from '../components/Amount';
import ConfirmModal from '../components/ConfirmModal';
import SwipeModal from '../components/SwipeModal';
import i18n from '../i18n';
import dataService from '../services/dataService';
import cryptoService from '../services/cryptoService';
import exchangeRateService from '../services/exchangeRateService';
import { accountTypeConfig, colors } from '../theme/colors';
import CurrencyPickerModal from '../components/CurrencyPickerModal';
import { CURRENCIES, sym, code, convert } from '../utils/currency';

const { width: SCREEN_W } = Dimensions.get('window');
const TILE_GAP = 10;
const TILE_W = (SCREEN_W - 48 - TILE_GAP * 2) / 3;

const ACCOUNT_TYPES = [
  { id:'bank' },{ id:'credit' },{ id:'cash' },{ id:'mortgage' },
  { id:'loan' },{ id:'investment' },{ id:'debt' },{ id:'crypto' },{ id:'asset' },
];
const CURRENCY_SYMBOLS = CURRENCIES.map(c => c.symbol);
const typeLabel = (id) => i18n.t(id);

// Порядок групп: самые ходовые сверху
const GROUP_ORDER = ['cash','bank','credit','investment','asset','crypto','loan','mortgage','debt'];

export default function AccountsScreen() {
  const navigation = useNavigation();
  const [accounts, setAccounts] = useState([]);
  const [showEdit, setShowEdit] = useState(false);
  const [editAccount, setEditAccount] = useState(null);
  const [name, setName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [type, setType] = useState('bank');
  const [currency, setCurrency] = useState(sym());
  const [currencyCode, setCurrencyCode] = useState(CURRENCIES.find(c => c.symbol === sym())?.code || 'ILS');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [balance, setBalance] = useState('');
  const [overdraft, setOverdraft] = useState('');
  const [billingDay, setBillingDay] = useState(10);
  const [isActive, setIsActive] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [recurring, setRecurring] = useState([]);
  const [holdings, setHoldings] = useState([]); // editable list for current modal
  const [newCoin, setNewCoin] = useState('');
  const [newCoinAmount, setNewCoinAmount] = useState('');
  const [prices, setPrices] = useState({}); // live { SYMBOL: { price, change24h, stale } }
  const [refreshing, setRefreshing] = useState(false);
  const styles = createStyles();

  const loadData = async (force = false) => {
    const [accs, rec] = await Promise.all([dataService.getAccounts(), dataService.getRecurring()]);
    setAccounts(accs);
    setRecurring(rec);
    // Group crypto accounts by currency so each batch of prices is denominated
    // in the account's chosen currency (not global).
    const byCurrency = {}; // { USD: Set('BTC','ETH'), ILS: Set('SOL'), ... }
    accs.forEach(a => {
      if (a.type !== 'crypto' || !Array.isArray(a.holdings)) return;
      const accCode = CURRENCIES.find(c => c.symbol === a.currency)?.code || code();
      if (!byCurrency[accCode]) byCurrency[accCode] = new Set();
      a.holdings.forEach(h => h.symbol && byCurrency[accCode].add(h.symbol.toUpperCase()));
    });
    const currencies = Object.keys(byCurrency);
    if (currencies.length === 0) { setPrices({}); return; }
    const entries = await Promise.all(
      currencies.map(async (cur) => [cur, await cryptoService.fetchPrices([...byCurrency[cur]], cur, force)])
    );
    const next = {};
    entries.forEach(([cur, data]) => { next[cur] = data; });
    setPrices(next);
  };
  useFocusEffect(useCallback(() => { loadData(); }, []));

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([exchangeRateService.refresh(true), loadData(true)]);
    } finally {
      setRefreshing(false);
    }
  };

  // Compute balance for crypto account from holdings, denominated in the
  // account's own currency (prices were fetched per-currency in loadData).
  const cryptoBalance = (acc) => {
    if (!Array.isArray(acc.holdings) || acc.holdings.length === 0) return acc.balance || 0;
    const accCode = CURRENCIES.find(c => c.symbol === acc.currency)?.code || code();
    const priceMap = prices[accCode] || {};
    return cryptoService.holdingsValue(acc.holdings, priceMap);
  };
  const getAccountBalance = (acc) => acc.type === 'crypto' ? cryptoBalance(acc) : (acc.balance || 0);
  const getAccountCode = (acc) => CURRENCIES.find(c => c.symbol === acc.currency)?.code || code();

  // Calculate projected balance per account (current + upcoming recurring before end of month)
  // For credit accounts, `overdraft` field stores the credit limit → same math: minAllowed = -limit.
  // Only bank and credit accounts get overdraft/warning status: mortgage/debt/loan are
  // inherently negative and asset/investment/cash/crypto don't have an overdraft concept.
  const getAccountStatus = (acc) => {
    if (acc.type !== 'bank' && acc.type !== 'credit') return 'ok';
    const bal = acc.balance || 0;
    const limit = acc.overdraft || 0;
    const minAllowed = -limit;
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    const upcomingForAcc = recurring.filter(r =>
      r.isActive && r.account === acc.id && r.nextDate && r.nextDate <= endOfMonth
    );
    const projected = upcomingForAcc.reduce((s, r) => {
      return s + (r.type === 'expense' ? -r.amount : r.amount);
    }, bal);
    if (bal < minAllowed) return 'overdraft';
    if (projected < minAllowed) return 'warning';
    return 'ok';
  };

  const active = accounts.filter(a => a.isActive !== false);
  const inactive = accounts.filter(a => a.isActive === false);
  // Convert all account balances to global currency for total
  const globalCode = code();
  const totalBalance = active.reduce((s,a) => {
    const bal = getAccountBalance(a);
    const accCode = getAccountCode(a);
    return s + convert(bal, accCode, globalCode);
  }, 0);

  // Группировка: сохраняем порядок из массива accounts, группируем по типу
  const grouped = [];
  const seenTypes = new Set();
  active.forEach(a => {
    if (!seenTypes.has(a.type)) {
      seenTypes.add(a.type);
      const accs = active.filter(x => x.type === a.type);
      grouped.push({ typeId: a.type, accs, sum: accs.reduce((s, x) => {
        return s + convert(getAccountBalance(x), getAccountCode(x), globalCode);
      }, 0) });
    }
  });

  const openHistory = (acc) => navigation.navigate('AccountHistory', { account: acc });
  const openEdit = (acc) => {
    setEditAccount(acc); setName(acc.name); setAccountNumber(acc.accountNumber||'');
    setType(acc.type||'bank'); setCurrency(acc.currency||sym()); setBalance(acc.balance ? String(parseFloat(acc.balance.toFixed(2))) : '');
    setOverdraft(acc.overdraft ? String(acc.overdraft) : ''); setBillingDay(acc.billingDay||10); setIsActive(acc.isActive!==false);
    setHoldings(Array.isArray(acc.holdings) ? acc.holdings.map(h => ({ ...h })) : []);
    setNewCoin(''); setNewCoinAmount('');
    setShowEdit(true);
  };
  const openAdd = () => {
    setEditAccount(null); setName(''); setAccountNumber(''); setType('bank');
    setCurrency(sym()); setBalance(''); setOverdraft(''); setBillingDay(10); setIsActive(true);
    setHoldings([]); setNewCoin(''); setNewCoinAmount('');
    setShowEdit(true);
  };
  const addHolding = () => {
    const s = (newCoin || '').toUpperCase().trim();
    const amt = parseFloat((newCoinAmount || '').replace(',', '.'));
    if (!s || !amt || amt <= 0) return;
    if (holdings.find(h => h.symbol === s)) return; // duplicate guard
    setHoldings([...holdings, { symbol: s, amount: amt }]);
    setNewCoin(''); setNewCoinAmount('');
  };
  const removeHolding = (sym) => setHoldings(holdings.filter(h => h.symbol !== sym));
  const updateHoldingAmount = (sym, amount) => {
    const amt = parseFloat((amount || '').replace(',', '.'));
    setHoldings(holdings.map(h => h.symbol === sym ? { ...h, amount: amt || 0 } : h));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    const cfg = accountTypeConfig[type]||accountTypeConfig.bank;
    const data = { name:name.trim(), accountNumber:accountNumber.trim(), type, currency, balance:parseFloat((balance||'').replace(',','.'))||0, overdraft:overdraft?parseFloat(overdraft.replace(',','.')):null, billingDay: type==='credit'?billingDay:null, isActive, icon:cfg.icon };
    if (type === 'crypto') {
      data.holdings = holdings.filter(h => h.symbol && h.amount > 0);
    }
    if (editAccount) await dataService.updateAccount(editAccount.id, data);
    else await dataService.addAccount(data);
    setShowEdit(false); await loadData();
  };
  const handleDelete = async () => {
    if (deleteTarget) { await dataService.deleteAccount(deleteTarget.id); setDeleteTarget(null); setShowEdit(false); await loadData(); }
  };

  // Move within a type group. direction = -1 (up) / +1 (down).
  // Swaps the account with its nearest same-type neighbor in the full accounts array.
  const moveAccount = async (accId, direction) => {
    const acc = accounts.find(a => a.id === accId);
    if (!acc) return;
    const sameTypeActive = accounts.filter(a => a.type === acc.type && a.isActive !== false);
    const idxInGroup = sameTypeActive.findIndex(a => a.id === accId);
    const targetIdxInGroup = idxInGroup + direction;
    if (targetIdxInGroup < 0 || targetIdxInGroup >= sameTypeActive.length) return;
    const target = sameTypeActive[targetIdxInGroup];
    const fullIdxA = accounts.findIndex(a => a.id === accId);
    const fullIdxB = accounts.findIndex(a => a.id === target.id);
    const reordered = [...accounts];
    [reordered[fullIdxA], reordered[fullIdxB]] = [reordered[fullIdxB], reordered[fullIdxA]];
    setAccounts(reordered);
    await dataService.saveAccounts(reordered);
  };

  const tc = accountTypeConfig[type]?.color || colors.blue;

  const renderTile = (acc) => {
    const cfg = accountTypeConfig[acc.type] || accountTypeConfig.bank;
    const isCrypto = acc.type === 'crypto';
    const bal = getAccountBalance(acc);
    const status = isCrypto ? 'ok' : getAccountStatus(acc);
    const statusColor = status === 'overdraft' ? colors.red : status === 'warning' ? colors.orange : null;
    const balColor = status === 'overdraft' ? colors.red : status === 'warning' ? colors.orange : (bal >= 0 ? colors.green : colors.red);
    const holdingsCount = isCrypto && Array.isArray(acc.holdings) ? acc.holdings.length : 0;
    const displayCurrency = acc.currency;
    return (
      <TouchableOpacity key={acc.id}
        style={[styles.tile,
          { borderLeftColor: cfg.color, borderLeftWidth: 3 },
          statusColor && { borderColor: statusColor, borderWidth: 1, backgroundColor: statusColor + '08' }
        ]}
        onPress={() => openHistory(acc)} onLongPress={() => openEdit(acc)} activeOpacity={0.7}>
        <View style={styles.tileTop}>
          <MaterialCommunityIcons name={cfg.icon} size={16} color={cfg.color} />
          {statusColor && <Feather name="alert-triangle" size={14} color={statusColor} />}
        </View>
        <Text style={styles.tileName} numberOfLines={1}>{acc.name}</Text>
        <Amount value={bal} sign style={styles.tileBalance} color={balColor} numberOfLines={1} adjustsFontSizeToFit currency={displayCurrency} />
        {holdingsCount > 0 && <Text style={styles.tileSub} numberOfLines={1}>{holdingsCount} {i18n.t('coins')}</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.green} colors={[colors.green]} />}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{i18n.t('accounts')}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: reorderMode ? colors.green : colors.card, borderWidth: 1, borderColor: colors.cardBorder }]} onPress={() => setReorderMode(!reorderMode)}>
              <Feather name="list" size={18} color={reorderMode ? colors.bg : colors.textDim} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
              <Feather name="plus" size={20} color={colors.bg} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Total */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>{i18n.t('totalAssets')}</Text>
          <Amount value={totalBalance} sign style={styles.totalAmount} color={totalBalance >= 0 ? colors.green : colors.red} numberOfLines={1} adjustsFontSizeToFit />
        </View>

        {/* Hint */}
        <Text style={styles.hint}>
          {i18n.t('accountHint')}
        </Text>

        {/* Reorder mode — grouped by type so the order matches the normal view */}
        {reorderMode && grouped.map(({ typeId, accs }) => {
          const cfg = accountTypeConfig[typeId] || accountTypeConfig.bank;
          return (
            <View key={typeId} style={{ marginBottom: 16 }}>
              <View style={styles.groupHeader}>
                <MaterialCommunityIcons name={cfg.icon} size={14} color={cfg.color} />
                <Text style={[styles.groupTitle, { color: cfg.color }]}>{typeLabel(typeId)}</Text>
              </View>
              <View style={{ marginHorizontal: 20, gap: 6 }}>
                {accs.map((acc, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === accs.length - 1;
                  return (
                    <View key={acc.id} style={{ flexDirection: i18n.row(), alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.cardBorder, gap: 12 }}>
                      <MaterialCommunityIcons name={cfg.icon} size={18} color={cfg.color} />
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 }}>{acc.name}</Text>
                      <TouchableOpacity onPress={() => moveAccount(acc.id, -1)} style={{ padding: 6 }} disabled={isFirst}>
                        <Feather name="chevron-up" size={20} color={isFirst ? colors.textMuted + '40' : colors.text} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => moveAccount(acc.id, 1)} style={{ padding: 6 }} disabled={isLast}>
                        <Feather name="chevron-down" size={20} color={isLast ? colors.textMuted + '40' : colors.text} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}

        {/* Groups */}
        {!reorderMode && grouped.map(({ typeId, accs, sum }) => {
          const cfg = accountTypeConfig[typeId] || accountTypeConfig.bank;
          return (
            <View key={typeId}>
              <View style={styles.groupHeader}>
                <MaterialCommunityIcons name={cfg.icon} size={14} color={cfg.color} style={{ }} />
                <Text style={[styles.groupTitle, { color: cfg.color }]}>{typeLabel(typeId)}</Text>
                <Amount value={sum} sign style={styles.groupSum} color={sum >= 0 ? colors.textDim : colors.red} />
              </View>
              <View style={styles.tilesRow}>
                {accs.map(renderTile)}
              </View>
            </View>
          );
        })}

        {/* Inactive */}
        {!reorderMode && inactive.length > 0 && (
          <View>
            <View style={styles.groupHeader}>
              <Feather name="archive" size={14} color={colors.textMuted} style={{ }} />
              <Text style={styles.groupTitle}>{i18n.t('inactive')}</Text>
            </View>
            <View style={styles.tilesRow}>
              {inactive.map(acc => (
                <TouchableOpacity key={acc.id} style={[styles.tile, { opacity: 0.35 }, { borderLeftColor: colors.textMuted, borderLeftWidth: 3 }]}
                  onLongPress={() => openEdit(acc)}>
                  <Text style={styles.tileName} numberOfLines={1}>{acc.name}</Text>
                  <Amount value={acc.balance||0} sign style={[styles.tileBalance, { color: colors.textMuted }]} currency={acc.currency} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Edit/Add */}
      <SwipeModal visible={showEdit} onClose={() => setShowEdit(false)}>
        {({ close }) => (
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 80 }}>
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
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={i18n.t('accountNamePlaceholder')} placeholderTextColor={colors.textMuted} />

            <Text style={styles.fieldLabel}>{i18n.t('number')}</Text>
            <TextInput style={styles.input} value={accountNumber} onChangeText={setAccountNumber} placeholder="1234" placeholderTextColor={colors.textMuted} />

            <Text style={styles.fieldLabel}>{i18n.t('currency')}</Text>
            <TouchableOpacity style={styles.currPickerBtn} onPress={() => setShowCurrencyPicker(true)} activeOpacity={0.7}>
              <Text style={styles.currPickerSymbol}>{currency}</Text>
              <Text style={styles.currPickerCode}>{currencyCode}</Text>
              <Feather name="chevron-down" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            {type !== 'crypto' && (
              <>
                <Text style={styles.fieldLabel}>{i18n.t('balance')}</Text>
                <View style={styles.balRow}>
                  <Text style={[styles.balCur,{color:tc}]}>{currency}</Text>
                  <TextInput style={styles.balInput} value={balance} onChangeText={setBalance} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textMuted} />
                </View>
              </>
            )}

            {type === 'crypto' && (() => {
              const editPriceMap = prices[currencyCode] || {};
              return (
              <View style={{ marginBottom: 16 }}>
                <Text style={styles.fieldLabel}>{i18n.t('cryptoHoldings')}</Text>
                {holdings.length === 0 && (
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8, textAlign: i18n.textAlign() }}>
                    {i18n.t('cryptoNoHoldings')}
                  </Text>
                )}
                {holdings.map(h => {
                  const info = editPriceMap[h.symbol];
                  const val = (info?.price || 0) * (parseFloat(h.amount) || 0);
                  const change = info?.change24h || 0;
                  const changeColor = change >= 0 ? colors.green : colors.red;
                  return (
                    <View key={h.symbol} style={styles.holdingRow}>
                      <View style={{ width: 56 }}>
                        <Text style={styles.holdingSym}>{h.symbol}</Text>
                        {info && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Text style={[styles.holdingChange, { color: changeColor }]}>{change >= 0 ? '+' : ''}{change.toFixed(1)}%</Text>
                            {info.stale && <Feather name="wifi-off" size={9} color={colors.textMuted} />}
                          </View>
                        )}
                      </View>
                      <TextInput
                        style={styles.holdingAmt}
                        value={String(h.amount)}
                        onChangeText={(t) => updateHoldingAmount(h.symbol, t)}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                      />
                      <Amount value={val} style={styles.holdingVal} color={colors.textSecondary} currency={currency} />
                      <TouchableOpacity onPress={() => removeHolding(h.symbol)} style={styles.holdingDel}>
                        <Feather name="x" size={14} color={colors.red} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
                <View style={styles.addHoldingRow}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                    {cryptoService.getSupportedSymbols().filter(s => !holdings.find(h => h.symbol === s)).map(s => {
                      const active = newCoin === s;
                      return (
                        <TouchableOpacity key={s} style={[styles.coinChip, active && { borderColor: colors.orange, backgroundColor: colors.orange + '15' }]} onPress={() => setNewCoin(s)}>
                          <Text style={[styles.coinChipTxt, active && { color: colors.orange }]}>{s}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
                <View style={styles.addHoldingInputRow}>
                  <TextInput
                    style={styles.newCoinAmt}
                    value={newCoinAmount}
                    onChangeText={setNewCoinAmount}
                    keyboardType="numeric"
                    placeholder={newCoin ? `${i18n.t('amount')} ${newCoin}` : i18n.t('cryptoPickCoin')}
                    placeholderTextColor={colors.textMuted}
                    editable={!!newCoin}
                  />
                  <TouchableOpacity
                    style={[styles.addCoinBtn, (!newCoin || !parseFloat((newCoinAmount||'').replace(',','.'))) && { opacity: 0.4 }]}
                    onPress={addHolding}
                    disabled={!newCoin || !parseFloat((newCoinAmount||'').replace(',','.'))}
                  >
                    <Feather name="plus" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
              );
            })()}

            {(type==='bank'||type==='credit')&&(
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>{type==='credit'?i18n.t('creditLimit'):i18n.t('overdraft')}</Text>
                  <TextInput style={styles.input} value={overdraft} onChangeText={setOverdraft} keyboardType="numeric" placeholder="10000" placeholderTextColor={colors.textMuted} />
                </View>
                {type==='credit'&&(
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>{i18n.t('billingDay')}</Text>
                    <View style={styles.billingRow}>
                      {[2,10,15,20].map(d=>{
                        const sel = billingDay===d;
                        return (
                          <TouchableOpacity key={d} style={[styles.billingBtn, sel&&{borderColor:tc,backgroundColor:`${tc}12`}]}
                            onPress={()=>setBillingDay(d)}>
                            <Text style={[styles.billingTxt, sel&&{color:tc}]}>{d}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
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
              <TouchableOpacity style={[styles.saveBtn,{backgroundColor:tc,opacity:name.trim()?1:0.35}]} onPress={handleSave} disabled={!name.trim()}><Feather name="check" size={18} color={colors.bg} /><Text style={styles.saveText}> {i18n.t('save')}</Text></TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </SwipeModal>

      <ConfirmModal visible={!!deleteTarget} title={i18n.t('delete')} message={deleteTarget?.name||''} confirmText={i18n.t('delete')} cancelText={i18n.t('cancel')} onConfirm={handleDelete} onCancel={()=>setDeleteTarget(null)} />
      <CurrencyPickerModal visible={showCurrencyPicker}
        onClose={() => setShowCurrencyPicker(false)}
        selected={currencyCode}
        onSelect={(cur) => { setCurrency(cur.symbol); setCurrencyCode(cur.code); }} />
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  container:{flex:1,backgroundColor:colors.bg},
  header:{flexDirection:i18n.row(),justifyContent:'space-between',alignItems:'center',paddingHorizontal:24,paddingTop:60,paddingBottom:16},
  title:{color:colors.text,fontSize:24,fontWeight:'800',textAlign:i18n.textAlign()},
  addBtn:{width:44,height:44,borderRadius:14,backgroundColor:colors.green,justifyContent:'center',alignItems:'center'},

  totalCard:{marginHorizontal:24,marginBottom:8,backgroundColor:colors.card,borderRadius:20,padding:20,borderWidth:1,borderColor:colors.greenSoft},
  totalLabel:{color:colors.textDim,fontSize:12,marginBottom:6,textAlign:i18n.textAlign()},
  totalAmount:{fontSize:32,fontWeight:'800',textAlign:i18n.textAlign()},

  hint:{color:colors.textMuted,fontSize:12,textAlign:'center',marginBottom:12,opacity:0.5},

  groupHeader:{flexDirection:i18n.row(),alignItems:'center',paddingHorizontal:24,marginTop:20,marginBottom:8,gap:6},
  groupTitle:{color:colors.textDim,fontSize:12,fontWeight:'700',letterSpacing:1,textTransform:'uppercase',flex:1,textAlign:i18n.textAlign()},
  groupSum:{fontSize:12,fontWeight:'600'},

  tilesRow:{flexDirection:i18n.row(),flexWrap:'wrap',paddingHorizontal:24,gap:TILE_GAP},
  tile:{width:TILE_W,backgroundColor:colors.card,borderRadius:14,padding:12,borderWidth:1,borderColor:colors.cardBorder,marginBottom:TILE_GAP},
  tileTop:{marginBottom:6,flexDirection:i18n.row(),alignItems:'center',justifyContent:'space-between'},
  tileName:{color:colors.textSecondary,fontSize:12,fontWeight:'600',marginBottom:4,textAlign:i18n.textAlign()},
  tileBalance:{color:colors.text,fontSize:14,fontWeight:'700',textAlign:i18n.textAlign()},
  tileSub:{color:colors.textMuted,fontSize:10,fontWeight:'600',marginTop:2,textAlign:i18n.textAlign()},

  // Crypto holdings editor
  holdingRow:{flexDirection:i18n.row(),alignItems:'center',gap:8,backgroundColor:colors.card,borderRadius:12,padding:10,marginBottom:6,borderWidth:1,borderColor:colors.cardBorder},
  holdingSym:{color:colors.text,fontSize:14,fontWeight:'700'},
  holdingChange:{fontSize:10,fontWeight:'600'},
  holdingAmt:{flex:1,backgroundColor:colors.bg2,borderRadius:8,paddingHorizontal:10,paddingVertical:8,color:colors.text,fontSize:13,fontWeight:'600'},
  holdingVal:{fontSize:12,fontWeight:'700',minWidth:60,textAlign:i18n.isRTL()?'left':'right'},
  holdingDel:{width:28,height:28,borderRadius:8,backgroundColor:colors.redSoft,justifyContent:'center',alignItems:'center'},
  addHoldingRow:{marginTop:4,marginBottom:8},
  coinChip:{paddingHorizontal:10,paddingVertical:6,borderRadius:10,backgroundColor:colors.bg2,borderWidth:1,borderColor:colors.cardBorder,marginEnd:6},
  coinChipTxt:{color:colors.textDim,fontSize:11,fontWeight:'700'},
  addHoldingInputRow:{flexDirection:i18n.row(),alignItems:'center',gap:8},
  newCoinAmt:{flex:1,backgroundColor:colors.card,borderRadius:12,padding:12,color:colors.text,fontSize:14,fontWeight:'600',borderWidth:1,borderColor:colors.cardBorder,textAlign:i18n.textAlign()},
  addCoinBtn:{width:44,height:44,borderRadius:12,backgroundColor:colors.orange,justifyContent:'center',alignItems:'center'},

  modalTitle:{color:colors.text,fontSize:20,fontWeight:'700',marginBottom:20,textAlign:i18n.textAlign()},
  fieldLabel:{color:colors.textDim,fontSize:12,fontWeight:'700',letterSpacing:0.5,marginBottom:6,marginTop:4,textAlign:i18n.textAlign()},
  input:{backgroundColor:colors.card,borderRadius:14,padding:14,color:colors.text,fontSize:16,marginBottom:12,borderWidth:1,borderColor:colors.cardBorder,textAlign:i18n.textAlign()},
  typeChip:{flexDirection:i18n.row(),alignItems:'center',paddingHorizontal:14,paddingVertical:10,borderRadius:12,backgroundColor:colors.card,marginEnd:8,borderWidth:1.5,borderColor:'transparent'},
  typeChipText:{color:colors.textMuted,fontSize:12,fontWeight:'600',marginStart:6},
  currPickerBtn:{flexDirection:'row',alignItems:'center',backgroundColor:colors.card,borderRadius:14,padding:14,marginBottom:16,borderWidth:1,borderColor:colors.cardBorder,gap:12},
  currPickerSymbol:{color:colors.text,fontSize:20,fontWeight:'700',width:36,textAlign:'center'},
  currPickerCode:{color:colors.textSecondary,fontSize:16,fontWeight:'600',flex:1},
  billingRow:{flexDirection:'row',gap:8,marginBottom:16},
  billingBtn:{flex:1,paddingVertical:12,borderRadius:12,backgroundColor:colors.card,borderWidth:1.5,borderColor:'transparent',alignItems:'center'},
  billingTxt:{color:colors.textMuted,fontSize:16,fontWeight:'700'},
  balRow:{flexDirection:i18n.row(),alignItems:'center',marginBottom:16},
  balCur:{fontSize:32,fontWeight:'700',marginEnd:8},
  balInput:{flex:1,color:colors.text,fontSize:32,fontWeight:'700'},
  toggleRow:{flexDirection:i18n.row(),justifyContent:'space-between',alignItems:'center',paddingVertical:16,marginBottom:8,borderTopWidth:1,borderTopColor:colors.divider},
  toggleLabel:{color:colors.text,fontSize:14,fontWeight:'600'},
  toggleSub:{color:colors.textMuted,fontSize:12,marginTop:2},
  btnRow:{flexDirection:i18n.row(),gap:10,marginTop:8},
  delBtn:{width:54,paddingVertical:16,borderRadius:14,backgroundColor:colors.redSoft,alignItems:'center',justifyContent:'center'},
  cancelBtn:{flex:1,paddingVertical:16,borderRadius:14,backgroundColor:colors.card,alignItems:'center',borderWidth:1,borderColor:colors.cardBorder},
  cancelText:{color:colors.textDim,fontSize:16,fontWeight:'600'},
  saveBtn:{flex:2,flexDirection:i18n.row(),paddingVertical:16,borderRadius:14,alignItems:'center',justifyContent:'center'},
  saveText:{color:colors.bg,fontSize:16,fontWeight:'700'},
});