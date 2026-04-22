// src/screens/InvestmentsScreen.js
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Amount from '../components/Amount';
import Card from '../components/Card';
import ConfirmModal from '../components/ConfirmModal';
import SwipeModal from '../components/SwipeModal';
import i18n from '../i18n';
import dataService from '../services/dataService';
import stockService from '../services/stockService';
import { colors } from '../theme/colors';
import { sym } from '../utils/currency';

const INV_TYPES = ['pension', 'savings', 'education', 'stocks', 'bonds', 'real_estate', 'crypto', 'children'];

export default function InvestmentsScreen() {
  const navigation = useNavigation();
  const [investments, setInvestments] = useState([]);
  const [invAccounts, setInvAccounts] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [showEdit, setShowEdit] = useState(false);
  const [editInv, setEditInv] = useState(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('savings');
  const [balance, setBalance] = useState('');
  const [monthly, setMonthly] = useState('');
  const [holdings, setHoldings] = useState([]);
  const [newTicker, setNewTicker] = useState('');
  const [newShares, setNewShares] = useState('');
  const [newAvgCost, setNewAvgCost] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const styles = createStyles();

  const loadData = async (force = false) => {
    const [inv, accs] = await Promise.all([
      dataService.getInvestments(),
      dataService.getAccounts(),
    ]);
    setInvestments(inv);
    setInvAccounts(accs.filter(a => a.type === 'investment' && !a.archived));
    const tickers = new Set();
    inv.forEach(i => { if (i.type === 'stocks' && Array.isArray(i.holdings)) i.holdings.forEach(h => h.ticker && tickers.add(h.ticker)); });
    if (tickers.size > 0) {
      const q = await stockService.fetchQuotes([...tickers], force);
      setQuotes(q);
    } else {
      setQuotes({});
    }
  };
  useFocusEffect(useCallback(() => { loadData(); }, []));

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await loadData(true); } finally { setRefreshing(false); }
  };

  const invValue = (inv) => {
    if (inv.type === 'stocks' && Array.isArray(inv.holdings) && inv.holdings.length > 0) {
      return stockService.portfolioStats(inv.holdings, quotes).value;
    }
    return inv.balance || 0;
  };
  const invStats = (inv) => {
    if (inv.type === 'stocks' && Array.isArray(inv.holdings) && inv.holdings.length > 0) {
      return stockService.portfolioStats(inv.holdings, quotes);
    }
    return null;
  };
  const totalInvested =
    investments.reduce((sum, i) => sum + invValue(i), 0) +
    invAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalMonthly = investments.reduce((sum, i) => sum + (i.monthly || 0), 0);

  const typeIcon = (t) => {
    switch (t) {
      case 'pension': return 'shield';
      case 'savings': return 'trending-up';
      case 'education': return 'book-open';
      case 'stocks': return 'bar-chart-2';
      case 'bonds': return 'layers';
      case 'real_estate': return 'home';
      case 'crypto': return 'cpu';
      case 'children': return 'smile';
      default: return 'briefcase';
    }
  };

  const openAdd = () => {
    setEditInv(null); setName(''); setType('savings'); setBalance(''); setMonthly('');
    setHoldings([]); setNewTicker(''); setNewShares(''); setNewAvgCost('');
    setShowEdit(true);
  };
  const openEdit = (inv) => {
    setEditInv(inv); setName(inv.name || ''); setType(inv.type || 'savings');
    setBalance(inv.balance ? String(inv.balance) : ''); setMonthly(inv.monthly ? String(inv.monthly) : '');
    setHoldings(Array.isArray(inv.holdings) ? inv.holdings.map(h => ({ ...h })) : []);
    setNewTicker(''); setNewShares(''); setNewAvgCost('');
    setShowEdit(true);
  };
  const addHolding = () => {
    const t = stockService.normalizeTicker(newTicker);
    const s = parseFloat((newShares || '').replace(',', '.'));
    const c = parseFloat((newAvgCost || '').replace(',', '.'));
    if (!t || !s || s <= 0) return;
    if (holdings.find(h => h.ticker === t)) return;
    setHoldings([...holdings, { ticker: t, shares: s, avgCost: c || 0 }]);
    setNewTicker(''); setNewShares(''); setNewAvgCost('');
  };
  const removeHolding = (t) => setHoldings(holdings.filter(h => h.ticker !== t));
  const updateHoldingField = (ticker, field, val) => {
    const num = parseFloat((val || '').replace(',', '.'));
    setHoldings(holdings.map(h => h.ticker === ticker ? { ...h, [field]: num || 0 } : h));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    const data = {
      name: name.trim(),
      type,
      balance: parseFloat((balance || '').replace(',', '.')) || 0,
      monthly: parseFloat((monthly || '').replace(',', '.')) || 0,
    };
    if (type === 'stocks') {
      data.holdings = holdings.filter(h => h.ticker && h.shares > 0);
    }
    let updated;
    if (editInv) {
      updated = investments.map(i => i.id === editInv.id ? { ...i, ...data } : i);
    } else {
      const id = 'inv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      updated = [...investments, { id, ...data, createdAt: new Date().toISOString() }];
    }
    await dataService.saveInvestments(updated);
    setShowEdit(false);
    await loadData();
  };
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const updated = investments.filter(i => i.id !== deleteTarget.id);
    await dataService.saveInvestments(updated);
    setDeleteTarget(null);
    setShowEdit(false);
    await loadData();
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.teal} colors={[colors.teal]} />}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name={i18n.backIcon()} size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{i18n.t('investments')}</Text>
          <TouchableOpacity onPress={openAdd} style={styles.addBtn}>
            <Feather name="plus" size={20} color={colors.bg} />
          </TouchableOpacity>
        </View>

        <Card style={styles.totalCard}>
          <Text style={styles.totalLabel}>{i18n.t('totalInvested')}</Text>
          <Amount value={totalInvested} style={styles.totalAmount} numberOfLines={1} adjustsFontSizeToFit />
          <View style={styles.monthlyRow}>
            <Text style={styles.monthlyLabel}>{i18n.t('monthlyContribution')}</Text>
            <Amount value={totalMonthly} style={styles.monthlyAmount} />
          </View>
        </Card>

        {invAccounts.map(acc => (
          <Card key={acc.id} style={{ marginHorizontal: 20 }}>
            <TouchableOpacity onPress={() => navigation.navigate('AccountHistory', { account: acc })} activeOpacity={0.7}>
              <View style={styles.invRow}>
                <View style={[styles.invIconWrap, { backgroundColor: colors.teal + '18' }]}>
                  <Feather name="trending-up" size={20} color={colors.teal} />
                </View>
                <View style={styles.invInfo}>
                  <Text style={styles.invName}>{acc.name}</Text>
                  <Text style={styles.invType}>{i18n.t('investment')}</Text>
                </View>
                <View style={styles.invAmounts}>
                  <Amount value={acc.balance || 0} style={styles.invBalance} numberOfLines={1} adjustsFontSizeToFit currency={acc.currency} />
                </View>
              </View>
            </TouchableOpacity>
          </Card>
        ))}

        {investments.map(inv => {
          const stats = invStats(inv);
          const value = invValue(inv);
          return (
            <Card key={inv.id} style={{ marginHorizontal: 20 }}>
              <TouchableOpacity onPress={() => openEdit(inv)} activeOpacity={0.7}>
                <View style={styles.invRow}>
                  <View style={[styles.invIconWrap, { backgroundColor: colors.teal + '18' }]}>
                    <Feather name={typeIcon(inv.type)} size={20} color={colors.teal} />
                  </View>
                  <View style={styles.invInfo}>
                    <Text style={styles.invName}>{inv.name}</Text>
                    <Text style={styles.invType}>
                      {i18n.t(inv.type === 'savings' ? 'investSavings' : inv.type === 'education' ? 'investEducation' : inv.type)}
                      {inv.type === 'stocks' && Array.isArray(inv.holdings) && inv.holdings.length > 0 ? ` · ${inv.holdings.length} ${i18n.t('tickers')}` : ''}
                    </Text>
                  </View>
                  <View style={styles.invAmounts}>
                    <Amount value={value} style={styles.invBalance} numberOfLines={1} adjustsFontSizeToFit />
                    {stats && stats.cost > 0 && (
                      <Text style={[styles.invMonthly, { color: stats.pl >= 0 ? colors.green : colors.red }]}>
                        {stats.pl >= 0 ? '+' : ''}{stats.plPercent.toFixed(1)}%
                      </Text>
                    )}
                    {!stats && inv.monthly > 0 && (
                      <Text style={styles.invMonthly}>+{inv.monthly.toLocaleString()} / {i18n.t('month')}</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            </Card>
          );
        })}

        {investments.length === 0 && invAccounts.length === 0 && (
          <Card style={{ marginHorizontal: 20, marginTop: 12 }}>
            <View style={styles.emptyWrap}>
              <Feather name="trending-up" size={32} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>{i18n.t('noInvestments')}</Text>
              <Text style={styles.emptyText}>{i18n.t('investmentsHint')}</Text>
            </View>
          </Card>
        )}
      </ScrollView>

      <SwipeModal visible={showEdit} onClose={() => setShowEdit(false)}>
        {({ close }) => (
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 80 }}>
            <Text style={styles.modalTitle}>{editInv ? editInv.name : i18n.t('newInvestment')}</Text>

            <Text style={styles.fieldLabel}>{i18n.t('type')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {INV_TYPES.map(t => {
                const active = type === t;
                return (
                  <TouchableOpacity key={t} style={[styles.typeChip, active && styles.typeChipActive]} onPress={() => setType(t)}>
                    <Feather name={typeIcon(t)} size={14} color={active ? colors.teal : colors.textMuted} />
                    <Text style={[styles.typeChipTxt, active && { color: colors.teal }]}>
                      {i18n.t(t === 'savings' ? 'investSavings' : t === 'education' ? 'investEducation' : t)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.fieldLabel}>{i18n.t('name')}</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="..." placeholderTextColor={colors.textMuted} />

            {type !== 'stocks' && (
              <>
                <Text style={styles.fieldLabel}>{i18n.t('balance')}</Text>
                <TextInput style={styles.input} value={balance} onChangeText={setBalance} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textMuted} />
              </>
            )}

            <Text style={styles.fieldLabel}>{i18n.t('monthlyContribution')}</Text>
            <TextInput style={styles.input} value={monthly} onChangeText={setMonthly} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textMuted} />

            {type === 'stocks' && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.fieldLabel}>{i18n.t('stocksHoldings')}</Text>
                {holdings.length === 0 && (
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8, textAlign: i18n.textAlign() }}>
                    {i18n.t('stocksNoHoldings')}
                  </Text>
                )}
                {holdings.map(h => {
                  const q = quotes[h.ticker];
                  const price = q?.price || 0;
                  const val = (parseFloat(h.shares) || 0) * price;
                  const cost = (parseFloat(h.shares) || 0) * (parseFloat(h.avgCost) || 0);
                  const pl = val - cost;
                  const plColor = pl >= 0 ? colors.green : colors.red;
                  return (
                    <View key={h.ticker} style={styles.holdingBox}>
                      <View style={styles.holdingHead}>
                        <Text style={styles.holdingTicker}>{h.ticker}</Text>
                        {q && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Text style={[styles.holdingChange, { color: (q.change24h || 0) >= 0 ? colors.green : colors.red }]}>
                              {q.change24h >= 0 ? '+' : ''}{(q.change24h || 0).toFixed(2)}%
                            </Text>
                            {q.stale && <Feather name="wifi-off" size={10} color={colors.textMuted} />}
                          </View>
                        )}
                        <TouchableOpacity onPress={() => removeHolding(h.ticker)} style={styles.holdingDel}>
                          <Feather name="x" size={14} color={colors.red} />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.holdingInputs}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.miniLabel}>{i18n.t('shares')}</Text>
                          <TextInput style={styles.miniInput} value={String(h.shares)}
                            onChangeText={(v) => updateHoldingField(h.ticker, 'shares', v)}
                            keyboardType="numeric" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.miniLabel}>{i18n.t('avgCost')}</Text>
                          <TextInput style={styles.miniInput} value={String(h.avgCost)}
                            onChangeText={(v) => updateHoldingField(h.ticker, 'avgCost', v)}
                            keyboardType="numeric" />
                        </View>
                      </View>
                      <View style={styles.holdingFooter}>
                        <Text style={styles.miniMuted}>{i18n.t('value')}: <Amount value={val} /></Text>
                        {cost > 0 && (
                          <Text style={[styles.miniMuted, { color: plColor }]}>
                            {pl >= 0 ? '+' : ''}<Amount value={pl} />
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
                <View style={styles.addHoldingRow}>
                  <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={newTicker}
                    onChangeText={setNewTicker} placeholder={i18n.t('tickerPlaceholder')}
                    placeholderTextColor={colors.textMuted} autoCapitalize="characters" />
                </View>
                <View style={styles.addHoldingRow}>
                  <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={newShares}
                    onChangeText={setNewShares} placeholder={i18n.t('shares')}
                    placeholderTextColor={colors.textMuted} keyboardType="numeric" />
                  <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={newAvgCost}
                    onChangeText={setNewAvgCost} placeholder={i18n.t('avgCost')}
                    placeholderTextColor={colors.textMuted} keyboardType="numeric" />
                  <TouchableOpacity style={[styles.addCoinBtn, (!newTicker || !parseFloat((newShares||'').replace(',','.'))) && { opacity: 0.4 }]}
                    onPress={addHolding}
                    disabled={!newTicker || !parseFloat((newShares || '').replace(',', '.'))}>
                    <Feather name="plus" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.btnRow}>
              {editInv && (
                <TouchableOpacity style={styles.delBtn} onPress={() => setDeleteTarget(editInv)}>
                  <Feather name="trash-2" size={20} color={colors.red} />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.cancelBtn} onPress={close}>
                <Text style={styles.cancelTxt}>{i18n.t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, !name.trim() && { opacity: 0.35 }]} onPress={handleSave} disabled={!name.trim()}>
                <Feather name="check" size={18} color={colors.bg} />
                <Text style={styles.saveTxt}> {i18n.t('save')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </SwipeModal>

      <ConfirmModal visible={!!deleteTarget} title={i18n.t('delete')} message={deleteTarget?.name || ''}
        confirmText={i18n.t('delete')} cancelText={i18n.t('cancel')}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  addBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.teal, justifyContent: 'center', alignItems: 'center' },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', flex: 1, textAlign: 'center' },
  totalCard: { marginHorizontal: 20, borderWidth: 1, borderColor: 'rgba(52,211,153,0.12)' },
  totalLabel: { color: colors.textDim, fontSize: 12, marginBottom: 8, textAlign: i18n.textAlign() },
  totalAmount: { color: colors.text, fontSize: 32, fontWeight: '800', marginBottom: 16, textAlign: i18n.textAlign() },
  monthlyRow: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  monthlyLabel: { color: colors.textDim, fontSize: 12 },
  monthlyAmount: { color: colors.green, fontSize: 16, fontWeight: '700' },
  invRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 12 },
  invIconWrap: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  invInfo: { flex: 1 },
  invName: { color: colors.text, fontSize: 16, fontWeight: '600', textAlign: i18n.textAlign() },
  invType: { color: colors.textMuted, fontSize: 12, marginTop: 2, textAlign: i18n.textAlign() },
  invAmounts: { alignItems: i18n.isRTL() ? 'flex-start' : 'flex-end' },
  invBalance: { color: colors.text, fontSize: 16, fontWeight: '700' },
  invMonthly: { color: colors.green, fontSize: 12, marginTop: 2, fontWeight: '600' },
  emptyWrap: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  emptyText: { color: colors.textDim, fontSize: 12, textAlign: 'center', lineHeight: 20, paddingHorizontal: 12 },

  // Modal
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 20, textAlign: i18n.textAlign() },
  fieldLabel: { color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6, marginTop: 4, textAlign: i18n.textAlign() },
  input: { backgroundColor: colors.card, borderRadius: 14, padding: 14, color: colors.text, fontSize: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.cardBorder, textAlign: i18n.textAlign() },
  typeChip: { flexDirection: i18n.row(), alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.card, marginEnd: 8, borderWidth: 1.5, borderColor: 'transparent', gap: 4 },
  typeChipActive: { borderColor: colors.teal, backgroundColor: colors.teal + '12' },
  typeChipTxt: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },

  holdingBox: { backgroundColor: colors.card, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.cardBorder, gap: 8 },
  holdingHead: { flexDirection: i18n.row(), alignItems: 'center', gap: 8 },
  holdingTicker: { color: colors.text, fontSize: 14, fontWeight: '700', flex: 1 },
  holdingChange: { fontSize: 11, fontWeight: '700' },
  holdingDel: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.redSoft, justifyContent: 'center', alignItems: 'center' },
  holdingInputs: { flexDirection: i18n.row(), gap: 8 },
  miniLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '600', marginBottom: 4 },
  miniInput: { backgroundColor: colors.bg2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: colors.text, fontSize: 13, fontWeight: '600' },
  miniMuted: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  holdingFooter: { flexDirection: i18n.row(), justifyContent: 'space-between', paddingTop: 4 },
  addHoldingRow: { flexDirection: i18n.row(), gap: 8, marginTop: 6, marginBottom: 6 },
  addCoinBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.teal, justifyContent: 'center', alignItems: 'center' },

  btnRow: { flexDirection: i18n.row(), gap: 10, marginTop: 20 },
  delBtn: { width: 52, height: 52, borderRadius: 14, backgroundColor: colors.redSoft, justifyContent: 'center', alignItems: 'center' },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  cancelTxt: { color: colors.textDim, fontSize: 16, fontWeight: '600' },
  saveBtn: { flex: 2, flexDirection: i18n.row(), paddingVertical: 16, borderRadius: 14, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' },
  saveTxt: { color: colors.bg, fontSize: 16, fontWeight: '700' },
});
