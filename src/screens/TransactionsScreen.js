// src/screens/TransactionsScreen.js
// Поиск по имени, сумме, категории, получателю, заметке, тегам
// Фильтры: тип, дата, категория, счёт, диапазон сумм
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { mergeTransferPairs } from '../utils/transactions';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AddTransactionModal from '../components/AddTransactionModal';
import Amount from '../components/Amount';
import ConfirmModal from '../components/ConfirmModal';
import DatePickerModal from '../components/DatePickerModal';
import FirstTimeTooltip from '../components/FirstTimeTooltip';
import TransactionItem from '../components/TransactionItem';
import { getCachedGroups } from '../components/CategoryIcon';
import { getCatName } from '../components/CategoryPickerModal';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { accountTypeConfig, categoryConfig, colors } from '../theme/colors';
import { sym } from '../utils/currency';

export default function TransactionsScreen({ route }) {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editTx, setEditTx] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Advanced filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selCategories, setSelCategories] = useState([]); // empty = all
  const [selAccounts, setSelAccounts] = useState([]); // empty = all
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [showCalFrom, setShowCalFrom] = useState(false);
  const [showCalTo, setShowCalTo] = useState(false);
  const [weekStart, setWeekStart] = useState('sunday');
  const [projects, setProjects] = useState([]);
  const [selProjects, setSelProjects] = useState([]);

  const styles = createStyles();
  const lang = i18n.getLanguage();

  const loadData = async () => {
    const [txs, accs, settings, projs] = await Promise.all([dataService.getTransactions(), dataService.getAccounts(), dataService.getSettings(), dataService.getProjects()]);
    if (settings.weekStart) setWeekStart(settings.weekStart);
    setTransactions(txs);
    setAccounts(accs.filter(a => a.isActive !== false));
    setProjects(projs);
  };

  useFocusEffect(useCallback(() => {
    loadData();
    if (route?.params?.openAdd) {
      setShowAdd(true);
      if (route.params) route.params.openAdd = false;
    }
    if (route?.params?.filterProject) {
      setSelProjects([route.params.filterProject]);
      setShowFilters(true);
      if (route.params) route.params.filterProject = null;
    }
    if (route?.params?.filterDateFrom || route?.params?.filterDateTo) {
      if (route.params.filterDateFrom) setDateFrom(route.params.filterDateFrom);
      if (route.params.filterDateTo) setDateTo(route.params.filterDateTo);
      setShowFilters(true);
      if (route.params) { route.params.filterDateFrom = null; route.params.filterDateTo = null; }
    }
  }, [route?.params?.openAdd, route?.params?.filterProject, route?.params?.filterDateFrom, route?.params?.filterDateTo]));

  // Count active filters
  const activeFilterCount = (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (selCategories.length > 0 ? 1 : 0) + (selAccounts.length > 0 ? 1 : 0) + (amountMin ? 1 : 0) + (amountMax ? 1 : 0) + (selProjects.length > 0 ? 1 : 0);

  const clearAllFilters = () => {
    setDateFrom(''); setDateTo(''); setSelCategories([]); setSelAccounts([]); setAmountMin(''); setAmountMax(''); setSelProjects([]);
  };

  // Merge transfer pairs into single rows (memoized for 14K+ transactions)
  const { filtered, totalFiltered, usedCategories } = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''));
    const merged = mergeTransferPairs(sorted);
    let f = filter === 'all' ? merged : merged.filter(t => t.type === filter);

    // Поиск
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      f = f.filter(t => {
        const catName = (i18n.t(t.categoryId) || '').toLowerCase();
        const recipient = (t.recipient || '').toLowerCase();
        const note = (t.note || '').toLowerCase();
        const amount = String(t.amount);
        const tags = (t.tags || []).join(' ').toLowerCase();
        return catName.includes(q) || recipient.includes(q) || note.includes(q) || amount.includes(q) || tags.includes(q);
      });
    }

    // Advanced filters — single pass when possible
    if (dateFrom) f = f.filter(t => (t.date || t.createdAt || '').slice(0, 10) >= dateFrom);
    if (dateTo) f = f.filter(t => (t.date || t.createdAt || '').slice(0, 10) <= dateTo);
    if (selCategories.length > 0) f = f.filter(t => selCategories.includes(t.categoryId));
    if (selAccounts.length > 0) f = f.filter(t => selAccounts.includes(t.account));
    if (selProjects.length > 0) f = f.filter(t => selProjects.includes(t.projectId));
    if (amountMin) {
      const min = parseFloat((amountMin||'').replace(',', '.'));
      if (!isNaN(min)) f = f.filter(t => t.amount >= min);
    }
    if (amountMax) {
      const max = parseFloat((amountMax||'').replace(',', '.'));
      if (!isNaN(max)) f = f.filter(t => t.amount <= max);
    }

    return {
      filtered: f,
      totalFiltered: f.reduce((s, t) => s + (t.isTransfer ? 0 : t.type === 'income' ? t.amount : -t.amount), 0),
      usedCategories: [...new Set(transactions.map(t => t.categoryId))].filter(Boolean),
    };
  }, [transactions, filter, search, dateFrom, dateTo, selCategories, selAccounts, selProjects, amountMin, amountMax]);

  const toggleCategory = (cid) => setSelCategories(prev => prev.includes(cid) ? prev.filter(c => c !== cid) : [...prev, cid]);
  const toggleAccount = (aid) => setSelAccounts(prev => prev.includes(aid) ? prev.filter(a => a !== aid) : [...prev, aid]);

  const handleDelete = async () => {
    if (deleteTarget) {
      await dataService.deleteTransaction(deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    }
  };

  const handleDuplicate = async (tx) => {
    const { id, createdAt, ...rest } = tx;
    await dataService.addTransaction({
      ...rest,
      date: new Date().toISOString(),
      note: tx.note ? `${tx.note} (${i18n.t('copy')})` : `(${i18n.t('copy')})`,
    });
    await loadData();
  };

  const handleEdit = (tx) => { setEditTx(tx); };
  const handleCloseModal = () => { setShowAdd(false); setEditTx(null); };

  const toggleSearch = () => {
    if (showSearch) { setSearch(''); }
    setShowSearch(!showSearch);
  };

  const getAccIcon = (type) => (accountTypeConfig[type] || accountTypeConfig.bank).icon;

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{i18n.t('transactions')}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={[styles.searchBtn, showSearch && styles.searchBtnActive]} onPress={toggleSearch}>
            <Feather name={showSearch ? 'x' : 'search'} size={18} color={showSearch ? colors.green : colors.textDim} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.searchBtn, showFilters && styles.filterBtnActive]} onPress={() => setShowFilters(!showFilters)}>
            <Feather name="sliders" size={18} color={showFilters ? colors.teal : colors.textDim} />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{filtered.length}</Text>
          </View>
        </View>
      </View>

      {/* Search bar */}
      {showSearch && (
        <View style={styles.searchRow}>
          <Feather name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={i18n.t('searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoFocus
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Filters */}
      <View style={styles.filters}>
        {['all', 'expense', 'income'].map(f => {
          const active = filter === f;
          const label = f === 'all' ? i18n.t('all') : f === 'income' ? i18n.t('incomeType') : i18n.t('expenseType');
          const ic = f === 'all' ? 'list' : f === 'income' ? 'trending-up' : 'trending-down';
          const ac = f === 'expense' ? colors.red : f === 'income' ? colors.green : colors.blue;
          return (
            <TouchableOpacity key={f} style={[styles.filterBtn, active && { borderColor: ac, backgroundColor: `${ac}10` }]} onPress={() => setFilter(f)}>
              <Feather name={ic} size={14} color={active ? ac : colors.textMuted} style={{ marginEnd: 4 }} />
              <Text style={[styles.filterText, active && { color: ac }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Advanced filter panel */}
      {showFilters && (
        <View style={styles.filterPanel}>
          {/* Date range */}
          <View style={styles.filterSection}>
            <View style={styles.dateRow}>
              <TouchableOpacity style={[styles.dateBtn, dateFrom && styles.dateBtnActive]} onPress={() => setShowCalFrom(true)}>
                <Feather name="calendar" size={14} color={dateFrom ? colors.green : colors.textMuted} />
                <Text style={[styles.dateBtnText, dateFrom && { color: colors.text }]}>
                  {dateFrom ? formatFilterDate(dateFrom) : i18n.t('dateFrom')}
                </Text>
                {dateFrom ? (
                  <TouchableOpacity onPress={() => setDateFrom('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="x" size={12} color={colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
              <Feather name={i18n.isRTL() ? 'arrow-left' : 'arrow-right'} size={14} color={colors.textMuted} />
              <TouchableOpacity style={[styles.dateBtn, dateTo && styles.dateBtnActive]} onPress={() => setShowCalTo(true)}>
                <Feather name="calendar" size={14} color={dateTo ? colors.green : colors.textMuted} />
                <Text style={[styles.dateBtnText, dateTo && { color: colors.text }]}>
                  {dateTo ? formatFilterDate(dateTo) : i18n.t('dateTo')}
                </Text>
                {dateTo ? (
                  <TouchableOpacity onPress={() => setDateTo('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="x" size={12} color={colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            </View>
          </View>

          {/* Amount range */}
          <View style={styles.filterSection}>
            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <Text style={styles.filterLabel}>{i18n.t('amountFrom')}</Text>
                <TextInput style={styles.dateInput} value={amountMin} onChangeText={setAmountMin}
                  placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
              </View>
              <Feather name="minus" size={14} color={colors.textMuted} style={{ marginTop: 20 }} />
              <View style={styles.dateField}>
                <Text style={styles.filterLabel}>{i18n.t('amountTo')}</Text>
                <TextInput style={styles.dateInput} value={amountMax} onChangeText={setAmountMax}
                  placeholder="∞" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
              </View>
            </View>
          </View>

          {/* Category chips */}
          {usedCategories.length > 0 && (
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>{i18n.t('category')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  {usedCategories.map(cid => {
                    const cfg = categoryConfig[cid] || categoryConfig.other;
                    const sel = selCategories.includes(cid);
                    return (
                      <TouchableOpacity key={cid} style={[styles.chip, sel && { borderColor: cfg.color, backgroundColor: `${cfg.color}15` }]}
                        onPress={() => toggleCategory(cid)}>
                        <Feather name={cfg.icon} size={12} color={sel ? cfg.color : colors.textMuted} />
                        <Text style={[styles.chipText, sel && { color: cfg.color }]} numberOfLines={1}>{i18n.t(cid)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Account chips */}
          {accounts.length > 1 && (
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>{i18n.t('account')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  {accounts.map(acc => {
                    const sel = selAccounts.includes(acc.id);
                    return (
                      <TouchableOpacity key={acc.id} style={[styles.chip, sel && { borderColor: colors.teal, backgroundColor: `${colors.teal}15` }]}
                        onPress={() => toggleAccount(acc.id)}>
                        <MaterialCommunityIcons name={getAccIcon(acc.type)} size={12} color={sel ? colors.teal : colors.textMuted} />
                        <Text style={[styles.chipText, sel && { color: colors.teal }]} numberOfLines={1}>{acc.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Projects filter */}
          {projects.length > 0 && (
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>{i18n.t('project')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  {projects.map(proj => {
                    const sel = selProjects.includes(proj.id);
                    const pc = proj.color || '#a78bfa';
                    return (
                      <TouchableOpacity key={proj.id} style={[styles.chip, sel && { borderColor: pc, backgroundColor: `${pc}15` }]}
                        onPress={() => setSelProjects(prev => prev.includes(proj.id) ? prev.filter(id => id !== proj.id) : [...prev, proj.id])}>
                        <Feather name={proj.icon || 'folder'} size={12} color={sel ? pc : colors.textMuted} />
                        <Text style={[styles.chipText, sel && { color: pc }]} numberOfLines={1}>{proj.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.filterBtnRow}>
            {activeFilterCount > 0 && (
              <TouchableOpacity style={styles.clearBtn} onPress={clearAllFilters}>
                <Feather name="x" size={14} color={colors.red} />
                <Text style={styles.clearText}>{i18n.t('clearFilters')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.applyBtn} onPress={() => setShowFilters(false)}>
              <Feather name="search" size={14} color={colors.bg} />
              <Text style={styles.applyText}>{i18n.t('search')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Summary */}
      {filtered.length > 0 && (
        <View style={styles.summary}>
          {selProjects.length === 1 && (
            <Text style={{ color: projects.find(p => p.id === selProjects[0])?.color || '#a78bfa', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>
              {i18n.t('projectTotal')}: {projects.find(p => p.id === selProjects[0])?.name}
            </Text>
          )}
          <Amount value={totalFiltered} sign style={styles.summaryAmount} color={totalFiltered >= 0 ? colors.green : colors.red} />
          {!showSearch && !showFilters && (
            <Text style={styles.hint}>
              ← {i18n.t('swipeHint')}
            </Text>
          )}
          {showSearch && search.length > 0 && (
            <Text style={styles.hint}>
              {i18n.t('found')}: {filtered.length}
            </Text>
          )}
        </View>
      )}

      {/* First-time swipe hint */}
      {filtered.length > 0 && (
        <FirstTimeTooltip storageKey="tx_swipe_hint" text={i18n.t('txSwipeHint')} icon="chevrons-right" />
      )}

      {/* List */}
      <FlatList
        data={filtered}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TransactionItem
            transaction={item}
            currency={accounts.find(a => a.id === item.account)?.currency}
            onDelete={(t) => setDeleteTarget(t)}
            onEdit={handleEdit}
            onDuplicate={handleDuplicate}
          />
        )}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={100}
        windowSize={5}
        removeClippedSubviews={true}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name={search || activeFilterCount > 0 ? 'search' : 'inbox'} size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              {search || activeFilterCount > 0 ? i18n.t('noResults') : i18n.t('noTransactions')}
            </Text>
            {!(search || activeFilterCount > 0) && (
              <Text style={styles.emptyHint}>{i18n.t('noTransactionsHint')}</Text>
            )}
          </View>
        }
      />

      <AddTransactionModal
        visible={showAdd || !!editTx}
        onClose={handleCloseModal}
        onSave={() => loadData()}
        editTransaction={editTx}
      />

      <ConfirmModal
        visible={!!deleteTarget}
        title={i18n.t('delete')}
        message={deleteTarget ? `${deleteTarget.categoryName || getCatName(deleteTarget.categoryId, getCachedGroups(), i18n.getLanguage())} — ${deleteTarget.amount} ${sym()}` : ''}
        confirmText={i18n.t('delete')} cancelText={i18n.t('cancel')}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)}
      />

      <DatePickerModal visible={showCalFrom} onClose={() => setShowCalFrom(false)}
        onSelect={(d) => setDateFrom(d)} selectedDate={dateFrom} lang={lang} weekStart={weekStart} />
      <DatePickerModal visible={showCalTo} onClose={() => setShowCalTo(false)}
        onSelect={(d) => setDateTo(d)} selectedDate={dateTo} lang={lang} weekStart={weekStart} />
    </GestureHandlerRootView>
  );
}


function formatFilterDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 16 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', textAlign: i18n.textAlign() },
  headerRight: { flexDirection: i18n.row(), alignItems: 'center', gap: 10 },
  searchBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  searchBtnActive: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  filterBtnActive: { borderColor: colors.teal, backgroundColor: `${colors.teal}15` },
  filterBadge: { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.teal, justifyContent: 'center', alignItems: 'center' },
  filterBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  badge: { backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder },
  badgeText: { color: colors.textDim, fontSize: 14, fontWeight: '700' },

  searchRow: { flexDirection: i18n.row(), alignItems: 'center', marginHorizontal: 24, marginBottom: 12, backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.cardBorder, gap: 10 },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, paddingVertical: 12, textAlign: i18n.textAlign() },

  filters: { flexDirection: i18n.row(), paddingHorizontal: 24, gap: 8, marginBottom: 12, width: '100%' },
  filterBtn: { flex: 1, flexDirection: i18n.row(), paddingVertical: 12, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  filterText: { color: colors.textDim, fontSize: 12, fontWeight: '600' },

  // Advanced filter panel
  filterPanel: { marginHorizontal: 24, marginBottom: 12, backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.cardBorder },
  filterSection: { marginBottom: 12 },
  filterLabel: { color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6, textAlign: i18n.textAlign() },
  dateRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 8 },
  dateBtn: { flex: 1, flexDirection: i18n.row(), alignItems: 'center', gap: 6, backgroundColor: colors.bg2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.divider },
  dateBtnActive: { borderColor: colors.green, backgroundColor: `${colors.green}10` },
  dateBtnText: { color: colors.textMuted, fontSize: 12, fontWeight: '600', flex: 1 },
  dateField: { flex: 1 },
  dateInput: { backgroundColor: colors.bg2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontSize: 12, borderWidth: 1, borderColor: colors.divider, textAlign: i18n.textAlign() },
  chipRow: { flexDirection: i18n.row(), gap: 6 },
  chip: { flexDirection: i18n.row(), alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.bg2, borderWidth: 1, borderColor: 'transparent', gap: 4 },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '600', maxWidth: 80 },
  filterBtnRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  clearBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder },
  clearText: { color: colors.red, fontSize: 14, fontWeight: '600' },
  applyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.green },
  applyText: { color: colors.bg, fontSize: 14, fontWeight: '700' },

  summary: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 8 },
  summaryAmount: { fontSize: 16, fontWeight: '700', writingDirection: 'ltr' },
  hint: { color: colors.textMuted, fontSize: 12, opacity: 0.6 },

  list: { paddingHorizontal: 20, paddingBottom: 120 },
  emptyContainer: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyText: { color: colors.textMuted, fontSize: 14, fontWeight: '600', marginTop: 12 },
  emptyHint: { color: colors.textMuted, fontSize: 12, marginTop: 8, textAlign: 'center', lineHeight: 18, opacity: 0.8 },

  fab: { position: 'absolute', right: 24, bottom: 100, width: 60, height: 60, borderRadius: 18, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center', elevation: 10, shadowColor: colors.green, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16 },
});
