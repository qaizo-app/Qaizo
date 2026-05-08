// src/screens/ShoppingListScreen.js
// רשימת קניות חכמה — מוצרים תכופים, בנה רשימה, היסטוריית מחירים
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Amount from '../components/Amount';
import Card from '../components/Card';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { colors } from '../theme/colors';
import { sym } from '../utils/currency';
import { tokenizeProduct, isSameProduct } from '../utils/productMatcher';

// Only food-related categories count for shopping list
const FOOD_CATS = ['food', 'grocery', 'restaurant', 'fastfood', 'delivery'];

export default function ShoppingListScreen() {
  const navigation = useNavigation();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('frequent'); // frequent, list, all
  const [checkedItems, setCheckedItems] = useState({});
  const [showBuildList, setShowBuildList] = useState(false);
  const [listItems, setListItems] = useState({}); // {itemName: true}
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [newItemNote, setNewItemNote] = useState('');
  const [manualItems, setManualItems] = useState([]); // manually added items
  const [loaded, setLoaded] = useState(false);
  const [mergeSource, setMergeSource] = useState(null); // item user wants to merge FROM
  const [historyItem, setHistoryItem] = useState(null); // item shown in price-history modal
  const st = createSt();

  useFocusEffect(useCallback(() => {
    loadItems();
    loadStoredList();
  }, []));

  const loadStoredList = async () => {
    try {
      const stored = await dataService.getShoppingList();
      if (stored) {
        setManualItems(Array.isArray(stored.manualItems) ? stored.manualItems : []);
        setListItems(stored.listItems || {});
        setCheckedItems(stored.checkedItems || {});
      }
    } finally {
      setLoaded(true);
    }
  };

  // Persist any user change to storage. Wait for initial load to avoid
  // wiping existing data with the empty defaults before loadStoredList finishes.
  useEffect(() => {
    if (!loaded) return;
    dataService.saveShoppingList({ manualItems, listItems, checkedItems });
  }, [loaded, manualItems, listItems, checkedItems]);

  const loadItems = async () => {
    const txs = await dataService.getTransactions();
    const mergeOverridesRaw = await dataService.getProductMergeOverrides?.();
    const mergeOverrides = mergeOverridesRaw || {};

    // Group similar product names via fuzzy matcher. Build a list of
    // group entries; for each new line item, try to match it against any
    // existing group with same store first (high confidence), then
    // cross-store (stricter threshold).
    const groups = []; // [{ canonicalName, names: Set, history, isFood, lastStore }]
    const findGroupFor = (name, store) => {
      // Manual merge override beats fuzzy logic
      const trimmed = (name || '').trim();
      const overrideTo = mergeOverrides[trimmed.toLowerCase()];
      if (overrideTo) {
        const direct = groups.find(g => g.canonicalName.toLowerCase() === overrideTo.toLowerCase());
        if (direct) return direct;
      }
      // Try same-store match first
      for (const g of groups) {
        const lastStore = (g.lastStore || '').toLowerCase();
        const sameStore = !!store && lastStore === String(store).toLowerCase();
        if (sameStore && g.names.some(n => isSameProduct(n, name, { sameStore: true }))) return g;
      }
      // Try cross-store with stricter threshold
      for (const g of groups) {
        if (g.names.some(n => isSameProduct(n, name, { sameStore: false }))) return g;
      }
      return null;
    };

    txs.forEach(tx => {
      if (!tx.receiptItems?.length) return;
      const store = tx.recipient || '';
      const date = (tx.date || tx.createdAt || '').slice(0, 10);
      const isFood = FOOD_CATS.includes(tx.categoryId);

      tx.receiptItems.forEach(item => {
        if (!item.name || !item.price) return;
        const name = String(item.name).trim();
        let group = findGroupFor(name, store);
        if (!group) {
          group = {
            canonicalName: name,
            names: [name],
            history: [],
            isFood,
            lastStore: store,
          };
          groups.push(group);
        } else {
          if (!group.names.includes(name)) group.names.push(name);
        }
        group.history.push({
          price: typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0,
          store, date,
        });
        if (isFood) group.isFood = true;
        // Use the most recent store for matching subsequent items
        if (date >= ((group.lastStoreDate || '0000-00-00'))) {
          group.lastStore = store;
          group.lastStoreDate = date;
        }
      });
    });

    const itemMap = {};
    groups.forEach(g => {
      itemMap[g.canonicalName.toLowerCase()] = {
        name: g.canonicalName,
        history: g.history,
        isFood: g.isFood,
        aliases: g.names,
      };
    });

    const now = new Date();
    const result = Object.values(itemMap).map(item => {
      const prices = item.history.map(h => h.price).filter(p => p > 0);
      const sorted = [...item.history].sort((a, b) => b.date.localeCompare(a.date));
      const lastPrice = sorted[0]?.price || 0;
      const prevPrice = sorted[1]?.price || 0;
      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
      const avgPrice = prices.length > 0 ? Math.round(prices.reduce((s, p) => s + p, 0) / prices.length * 100) / 100 : 0;
      const change = prevPrice > 0 ? Math.round(((lastPrice - prevPrice) / prevPrice) * 100) : 0;

      // Days since last purchase
      const lastDate = sorted[0]?.date;
      const daysSince = lastDate ? Math.floor((now - new Date(lastDate)) / (1000 * 60 * 60 * 24)) : 999;

      // Average days between purchases
      let avgDaysBetween = 0;
      if (sorted.length > 1) {
        const dates = sorted.map(h => new Date(h.date).getTime());
        let totalGap = 0;
        for (let i = 0; i < dates.length - 1; i++) totalGap += dates[i] - dates[i + 1];
        avgDaysBetween = Math.round(totalGap / (dates.length - 1) / (1000 * 60 * 60 * 24));
      }

      // Need to buy? (overdue by 50%+)
      const needToBuy = sorted.length >= 2 && avgDaysBetween > 0 && daysSince > avgDaysBetween * 1.3;

      // Find cheapest store
      const storeMap = {};
      item.history.forEach(h => {
        if (!storeMap[h.store] || h.price < storeMap[h.store]) storeMap[h.store] = h.price;
      });
      const stores = Object.entries(storeMap).sort((a, b) => a[1] - b[1]);

      return {
        name: item.name,
        aliases: item.aliases || [item.name],
        lastPrice, avgPrice, minPrice, maxPrice, change,
        count: item.history.length,
        history: sorted, // {price, store, date} desc
        lastStore: sorted[0]?.store || '',
        lastDate: sorted[0]?.date || '',
        daysSince, avgDaysBetween, needToBuy,
        isFood: item.isFood,
        stores,
      };
    });

    setItems(result);
  };

  const addManualItem = () => {
    const name = newItemName.trim();
    if (!name) return;
    const price = parseFloat((newItemPrice || '').replace(',', '.')) || 0;
    const qty = parseFloat((newItemQty || '').replace(',', '.')) || 0;
    const note = newItemNote.trim();
    const existingIdx = manualItems.findIndex(i => i.name.toLowerCase() === name.toLowerCase());
    const base = {
      name,
      lastPrice: price, avgPrice: price, minPrice: price, maxPrice: price, change: 0,
      count: 0, lastStore: '', lastDate: '', daysSince: 0, avgDaysBetween: 0,
      needToBuy: false, isFood: true, stores: [], isManual: true,
      quantity: qty || undefined, note: note || undefined,
    };
    if (existingIdx === -1) {
      setManualItems(prev => [...prev, base]);
    } else {
      // Update price/qty/note if user re-added with new details
      setManualItems(prev => prev.map((it, i) => i === existingIdx ? { ...it, ...base } : it));
    }
    setListItems(prev => ({ ...prev, [name]: true }));
    setNewItemName(''); setNewItemPrice(''); setNewItemQty(''); setNewItemNote('');
    setShowAddItem(false);
    setTab('list');
  };

  const toggleCheck = (name) => {
    setCheckedItems(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const toggleListItem = (name) => {
    setListItems(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const getFilteredItems = () => {
    const allItems = [...items, ...manualItems.filter(m => !items.find(i => i.name.toLowerCase() === m.name.toLowerCase()))];
    let filtered = allItems;

    // Search
    if (search) {
      filtered = filtered.filter(item => item.name.toLowerCase().includes(search.toLowerCase()));
    }

    // Tab filter
    if (tab === 'frequent') {
      // Items bought 2+ times, sorted by frequency, show "need to buy" first
      filtered = filtered.filter(i => i.count >= 2 && i.isFood);
      filtered.sort((a, b) => {
        if (a.needToBuy && !b.needToBuy) return -1;
        if (!a.needToBuy && b.needToBuy) return 1;
        return b.count - a.count;
      });
    } else if (tab === 'list') {
      // Only items in shopping list
      filtered = filtered.filter(i => listItems[i.name]);
    } else {
      filtered.sort((a, b) => b.count - a.count);
    }

    return filtered;
  };

  const shareList = async () => {
    // Share everything on the list — merge scanned items with manual ones.
    const allItems = [...items, ...manualItems.filter(m => !items.find(i => i.name.toLowerCase() === m.name.toLowerCase()))];
    const inList = allItems.filter(i => listItems[i.name]);
    if (inList.length === 0) return;
    const text = inList.map(i => {
      const mark = checkedItems[i.name] ? '☑' : '☐';
      const qty = i.quantity ? ` ×${i.quantity}` : '';
      const price = i.lastPrice > 0 ? ` — ${i.lastPrice} ${sym()}` : '';
      return `${mark} ${i.name}${qty}${price}`;
    }).join('\n');
    await Share.share({ message: `${i18n.t('shoppingList')}:\n\n${text}` });
  };

  const filtered = getFilteredItems();
  const listCount = Object.values(listItems).filter(Boolean).length;
  const checkedCount = Object.values(checkedItems).filter(Boolean).length;

  return (
    <View style={st.container}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={st.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
            <Feather name={i18n.backIcon()} size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={st.title}>{i18n.t('shoppingList')}</Text>
          <TouchableOpacity onPress={shareList} style={[st.shareBtn, listCount === 0 && { opacity: 0.35 }]} disabled={listCount === 0}>
            <Feather name="share-2" size={18} color={colors.green} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={st.searchRow}>
          <Feather name="search" size={16} color={colors.textMuted} />
          <TextInput style={[st.searchInput, { textAlign: i18n.textAlign() }]} value={search} onChangeText={setSearch}
            placeholder={i18n.t('search')} placeholderTextColor={colors.textMuted} />
        </View>

        {/* Tabs */}
        <View style={st.tabsRow}>
          {[
            { key: 'frequent', label: i18n.t('mostBought'), icon: 'repeat' },
            { key: 'list', label: `${i18n.t('myList')} ${listCount > 0 ? `(${listCount})` : ''}`, icon: 'check-square' },
            { key: 'all', label: i18n.t('seeAll'), icon: 'list' },
          ].map(t => (
            <TouchableOpacity key={t.key} style={[st.tabBtn, tab === t.key && st.tabActive]}
              onPress={() => setTab(t.key)} activeOpacity={0.7}>
              <Feather name={t.icon} size={13} color={tab === t.key ? colors.bg : colors.textMuted} />
              <Text style={[st.tabText, tab === t.key && st.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Empty state */}
        {filtered.length === 0 && (
          <Card>
            <View style={st.empty}>
              <Feather name="shopping-cart" size={48} color={colors.textMuted} />
              <Text style={st.emptyTitle}>
                {tab === 'list' ? i18n.t('emptyList') : items.length === 0 ? i18n.t('noReceiptItems') : i18n.t('noResults')}
              </Text>
              {items.length === 0 && <Text style={st.emptyText}>{i18n.t('scanReceiptHint')}</Text>}
            </View>
          </Card>
        )}

        {/* Items */}
        {filtered.map((item, idx) => {
          const isInList = listItems[item.name];
          const isChecked = checkedItems[item.name];

          return (
            <TouchableOpacity key={idx} activeOpacity={0.8}
              onPress={() => tab === 'list' ? toggleCheck(item.name) : toggleListItem(item.name)}
              onLongPress={() => setHistoryItem(item)}
              delayLongPress={400}>
              <Card>
                <View style={st.itemHeader}>
                  {/* Checkbox in list mode */}
                  {tab === 'list' && (
                    <View style={[st.checkbox, isChecked && st.checkboxChecked]}>
                      {isChecked && <Feather name="check" size={14} color={colors.bg} />}
                    </View>
                  )}

                  {/* Add to list icon in other modes */}
                  {tab !== 'list' && (
                    <TouchableOpacity onPress={() => toggleListItem(item.name)} style={st.addListBtn}>
                      <Feather name={isInList ? 'check-circle' : 'plus-circle'} size={20}
                        color={isInList ? colors.green : colors.textMuted} />
                    </TouchableOpacity>
                  )}

                  <View style={{ flex: 1 }}>
                    <Text style={[st.itemName, isChecked && st.itemNameChecked]} numberOfLines={1}>{item.name}</Text>
                    {item.lastStore ? (
                      <Text style={st.itemStore}>{item.lastStore}</Text>
                    ) : null}
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={st.itemPrice}>{item.lastPrice} {sym()}</Text>
                    {item.change !== 0 && (
                      <Text style={[st.itemChange, { color: item.change > 0 ? colors.red : colors.green }]}>
                        {item.change > 0 ? '↑' : '↓'}{Math.abs(item.change)}%
                      </Text>
                    )}
                  </View>
                </View>

                {/* Need to buy badge */}
                {item.needToBuy && tab === 'frequent' && (
                  <View style={st.needBadge}>
                    <Feather name="alert-circle" size={12} color={colors.orange} />
                    <Text style={st.needText}>
                      {i18n.t('notBoughtDays').replace('{days}', item.daysSince)}
                    </Text>
                  </View>
                )}

                {/* Stats — only in "all" tab */}
                {tab === 'all' && (
                  <View style={st.statsRow}>
                    <Text style={st.statText}>{item.count}x</Text>
                    {item.minPrice !== item.maxPrice && (
                      <Text style={st.statText}>{item.minPrice}—{item.maxPrice}</Text>
                    )}
                    {item.stores.length > 1 && (
                      <Text style={st.statText}>{i18n.t('cheapest')}: {item.stores[0][0]}</Text>
                    )}
                  </View>
                )}
              </Card>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* FAB — Add item */}
      <TouchableOpacity style={st.fab} onPress={() => setShowAddItem(true)} activeOpacity={0.8}>
        <Feather name="plus" size={24} color={colors.bg} />
      </TouchableOpacity>

      {/* Add item modal */}
      <Modal visible={showAddItem} transparent animationType="fade" onRequestClose={() => setShowAddItem(false)}>
        <KeyboardAvoidingView style={[st.modalOverlay, { width: '100%' }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={[st.modalOverlay, { width: '100%' }]} activeOpacity={1} onPress={() => setShowAddItem(false)}>
            <TouchableOpacity style={st.modalCard} activeOpacity={1} onPress={() => {}}>
              <Text style={st.modalTitle}>{i18n.t('addItem')}</Text>

              <Text style={st.fieldLabel}>{i18n.t('itemName')}</Text>
              <TextInput
                style={[st.modalInput, { textAlign: i18n.textAlign() }]}
                value={newItemName}
                onChangeText={setNewItemName}
                placeholder={i18n.t('itemName')}
                placeholderTextColor={colors.textMuted}
                autoFocus
                returnKeyType="next"
              />

              <View style={st.rowFields}>
                <View style={{ flex: 1 }}>
                  <Text style={st.fieldLabel}>{i18n.t('price')} ({sym()})</Text>
                  <TextInput
                    style={[st.modalInput, { textAlign: i18n.textAlign() }]}
                    value={newItemPrice}
                    onChangeText={setNewItemPrice}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    returnKeyType="next"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.fieldLabel}>{i18n.t('quantity')}</Text>
                  <TextInput
                    style={[st.modalInput, { textAlign: i18n.textAlign() }]}
                    value={newItemQty}
                    onChangeText={setNewItemQty}
                    placeholder="1"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    returnKeyType="next"
                  />
                </View>
              </View>

              <Text style={st.fieldLabel}>{i18n.t('note')}</Text>
              <TextInput
                style={[st.modalInput, { textAlign: i18n.textAlign() }]}
                value={newItemNote}
                onChangeText={setNewItemNote}
                placeholder={i18n.t('optional')}
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                onSubmitEditing={addManualItem}
              />

              <View style={st.modalBtnRow}>
                <TouchableOpacity style={st.modalCancelBtn} onPress={() => setShowAddItem(false)}>
                  <Text style={st.modalCancelText}>{i18n.t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.modalBtn, { flex: 1 }, !newItemName.trim() && { opacity: 0.4 }]} onPress={addManualItem} disabled={!newItemName.trim()}>
                  <Feather name="plus" size={18} color={colors.bg} />
                  <Text style={st.modalBtnText}>{i18n.t('add')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Price history + actions modal (long-press a product) */}
      <Modal visible={!!historyItem} transparent animationType="fade" onRequestClose={() => setHistoryItem(null)}>
        <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={() => setHistoryItem(null)}>
          <TouchableOpacity style={st.modalCard} activeOpacity={1} onPress={() => {}}>
            {historyItem && (() => {
              const hist = (historyItem.history || []).slice(0, 12); // newest first, cap to 12
              const sortedAsc = [...hist].reverse();
              const prices = sortedAsc.map(h => h.price);
              const maxP = Math.max(...prices, 0.01);
              const minP = Math.min(...prices);
              return (
                <>
                  <Text style={st.modalTitle} numberOfLines={2}>{historyItem.name}</Text>
                  {historyItem.aliases && historyItem.aliases.length > 1 && (
                    <Text style={st.aliasesTxt}>{i18n.t('alsoSeenAs')}: {historyItem.aliases.filter(n => n !== historyItem.name).join(', ')}</Text>
                  )}
                  {/* Mini price chart */}
                  {prices.length >= 2 && (
                    <View style={st.priceChartWrap}>
                      <View style={st.priceChartRow}>
                        {sortedAsc.map((h, idx) => {
                          const heightPct = maxP > minP ? ((h.price - minP) / (maxP - minP)) * 100 : 50;
                          return (
                            <View key={idx} style={st.priceChartCol}>
                              <View style={[st.priceChartBar, { height: `${Math.max(8, heightPct)}%` }]} />
                            </View>
                          );
                        })}
                      </View>
                      <View style={st.priceChartScale}>
                        <Text style={st.priceChartScaleTxt}>{minP} {sym()}</Text>
                        <Text style={st.priceChartScaleTxt}>{maxP} {sym()}</Text>
                      </View>
                    </View>
                  )}
                  {/* History rows */}
                  <ScrollView style={{ maxHeight: 200 }}>
                    {hist.map((h, idx) => (
                      <View key={idx} style={st.histRow}>
                        <Text style={st.histDate}>{h.date}</Text>
                        <Text style={st.histStore} numberOfLines={1}>{h.store || '—'}</Text>
                        <Text style={st.histPrice}>{h.price} {sym()}</Text>
                      </View>
                    ))}
                  </ScrollView>
                  <View style={st.modalBtnRow}>
                    <TouchableOpacity style={st.modalCancelBtn} onPress={() => { setMergeSource(historyItem); setHistoryItem(null); }}>
                      <Feather name="git-merge" size={14} color={colors.textDim} />
                      <Text style={st.modalCancelText}>  {i18n.t('mergeWith')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[st.modalBtn, { flex: 1 }]} onPress={() => setHistoryItem(null)}>
                      <Feather name="check" size={18} color={colors.bg} />
                      <Text style={st.modalBtnText}>{i18n.t('close')}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Merge picker modal */}
      <Modal visible={!!mergeSource} transparent animationType="fade" onRequestClose={() => setMergeSource(null)}>
        <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={() => setMergeSource(null)}>
          <TouchableOpacity style={st.modalCard} activeOpacity={1} onPress={() => {}}>
            <Text style={st.modalTitle}>{i18n.t('mergeProductTitle')}</Text>
            <Text style={st.aliasesTxt}>{i18n.t('mergeFrom')}: {mergeSource?.name}</Text>
            <ScrollView style={{ maxHeight: 320, marginTop: 8 }}>
              {[...items, ...manualItems]
                .filter(i => i.name !== mergeSource?.name)
                .slice(0, 30)
                .map((target, idx) => (
                  <TouchableOpacity key={idx} style={st.mergeTargetRow}
                    onPress={async () => {
                      if (!mergeSource) return;
                      await dataService.saveProductMergeOverride(mergeSource.name, target.name);
                      setMergeSource(null);
                      loadItems();
                    }}>
                    <Feather name="git-merge" size={14} color={colors.green} />
                    <Text style={st.mergeTargetTxt} numberOfLines={1}>{target.name}</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
            <TouchableOpacity style={[st.modalCancelBtn, { marginTop: 12 }]} onPress={() => setMergeSource(null)}>
              <Text style={st.modalCancelText}>{i18n.t('cancel')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const createSt = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  shareBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.greenSoft, justifyContent: 'center', alignItems: 'center' },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginBottom: 12, backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.cardBorder },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, paddingVertical: 12 },

  tabsRow: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, backgroundColor: colors.card, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: colors.cardBorder },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: 10 },
  tabActive: { backgroundColor: colors.green },
  tabText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: colors.bg, fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 32 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 12 },
  emptyText: { color: colors.textMuted, fontSize: 12, marginTop: 4, textAlign: 'center' },

  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  addListBtn: { padding: 4 },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: colors.textMuted, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: colors.green, borderColor: colors.green },
  itemName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  itemNameChecked: { textDecorationLine: 'line-through', color: colors.textMuted },
  itemStore: { color: colors.textMuted, fontSize: 12, fontWeight: '500', marginTop: 2 },
  itemPrice: { color: colors.text, fontSize: 16, fontWeight: '700' },
  itemChange: { fontSize: 12, fontWeight: '700', marginTop: 2 },

  needBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: colors.orange + '15', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
  needText: { color: colors.orange, fontSize: 12, fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  statText: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },

  fab: { position: 'absolute', bottom: 100, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: colors.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  // Width 92% of the parent stays hugging the screen edges; maxWidth caps
  // it on tablets / large phones so the dialog doesn't sprawl. The inner
  // overlay TouchableOpacity above sets width: '100%' so the percentage
  // here resolves against the full screen width instead of collapsing to
  // intrinsic size under alignItems:'center' on Android.
  modalCard: { backgroundColor: colors.card, borderRadius: 20, padding: 24, width: '92%', maxWidth: 500, borderWidth: 1, borderColor: colors.cardBorder },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 20, textAlign: i18n.textAlign() },
  modalInput: { backgroundColor: colors.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 15, borderWidth: 1, borderColor: colors.cardBorder, marginBottom: 12, textAlign: i18n.textAlign() },
  fieldLabel: { color: colors.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4, textAlign: i18n.textAlign(), alignSelf: 'stretch' },
  rowFields: { flexDirection: i18n.row(), gap: 10 },
  modalBtn: { backgroundColor: colors.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  modalBtnText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
  modalBtnRow: { flexDirection: i18n.row(), gap: 10, marginTop: 8 },
  modalCancelBtn: { flex: 1, flexDirection: i18n.row(), paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { color: colors.textDim, fontSize: 15, fontWeight: '600' },

  aliasesTxt: { color: colors.textDim, fontSize: 11, fontStyle: 'italic', marginBottom: 12, textAlign: i18n.textAlign() },
  priceChartWrap: { backgroundColor: colors.bg2, borderRadius: 12, padding: 12, marginBottom: 12 },
  priceChartRow: { flexDirection: 'row', alignItems: 'flex-end', height: 60, gap: 3 },
  priceChartCol: { flex: 1, justifyContent: 'flex-end', height: '100%' },
  priceChartBar: { width: '100%', backgroundColor: colors.green, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  priceChartScale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  priceChartScaleTxt: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
  histRow: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 8 },
  histDate: { color: colors.textMuted, fontSize: 11, fontWeight: '600', minWidth: 80 },
  histStore: { color: colors.textDim, fontSize: 12, flex: 1 },
  histPrice: { color: colors.text, fontSize: 13, fontWeight: '700' },
  mergeTargetRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: colors.divider },
  mergeTargetTxt: { color: colors.text, fontSize: 14, fontWeight: '500', flex: 1 },
});
