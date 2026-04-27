// src/components/CategoryPickerModal.js
// Выбор категории: топ-5 часто используемых + полный список с поиском
import { Feather, Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { categoryConfig, colors } from '../theme/colors';
import { setCachedGroups } from '../utils/categoryCache';
import { captureError } from '../services/logger';
import SwipeModal from './SwipeModal';

// Curated icon set for inline category creation. Feather names only — keeps
// the picker visually consistent with the built-in categories.
const PICKER_ICONS = [
  'tag', 'shopping-cart', 'shopping-bag', 'coffee', 'home', 'heart',
  'book-open', 'gift', 'phone', 'tv', 'globe', 'tool',
  'droplet', 'zap', 'sun', 'umbrella', 'briefcase', 'smile',
  'star', 'target', 'scissors', 'dollar-sign', 'trending-up', 'camera',
  'music', 'film', 'package', 'truck', 'layers', 'navigation',
  'map-pin', 'users', 'plus-circle',
];

export const DEFAULT_GROUPS = [
  { id: 'home', name: { ru:'Дом', he:'בית', en:'Home' }, icon: 'home', color: '#60a5fa',
    subs: [
      { id:'electricity', name:{ru:'Электричество',he:'חשמל',en:'Electricity'}, icon:'zap' },
      { id:'water', name:{ru:'Вода',he:'מים',en:'Water'}, icon:'droplet' },
      { id:'gas', name:{ru:'Газ',he:'גז',en:'Gas'}, icon:'sun' },
      { id:'arnona', name:{ru:'Налог на жильё',he:'ארנונה',en:'Property Tax'}, icon:'map-pin' },
      { id:'vaad', name:{ru:'Обслуживание дома',he:'ועד בית',en:'Building Fee'}, icon:'users' },
      { id:'cleaning', name:{ru:'Уборка',he:'ניקיון',en:'Cleaning'}, icon:'umbrella' },
      { id:'internet', name:{ru:'Интернет',he:'אינטרנט',en:'Internet'}, icon:'globe' },
      { id:'repairs', name:{ru:'Ремонт',he:'תיקונים',en:'Repairs'}, icon:'tool' },
    ]},
  { id: 'food', name: { ru:'Еда и продукты', he:'אוכל ומצרכים', en:'Food & Grocery' }, icon: 'shopping-cart', color: '#fb7185',
    subs: [
      { id:'grocery', name:{ru:'Супермаркет',he:'סופרמרקט',en:'Grocery'}, icon:'shopping-cart' },
      { id:'restaurant', name:{ru:'Рестораны',he:'מסעדות',en:'Restaurants'}, icon:'coffee' },
      { id:'fastfood', name:{ru:'Фастфуд',he:'מזון מהיר',en:'Fast Food'}, icon:'coffee' },
      { id:'delivery', name:{ru:'Доставка',he:'משלוחים',en:'Delivery'}, icon:'truck' },
    ]},
  { id: 'transport', name: { ru:'Авто и транспорт', he:'רכב ותחבורה', en:'Auto & Transport' }, icon: 'navigation', color: '#fb923c',
    subs: [
      { id:'fuel', name:{ru:'Топливо',he:'דלק',en:'Fuel'}, icon:'droplet' },
      { id:'parking', name:{ru:'Парковка',he:'חניה',en:'Parking'}, icon:'map-pin' },
      { id:'car_insurance', name:{ru:'Страховка авто',he:'ביטוח רכב',en:'Car Insurance'}, icon:'shield' },
      { id:'car_repair', name:{ru:'Ремонт авто',he:'תיקון רכב',en:'Car Repair'}, icon:'tool' },
      { id:'public_transport', name:{ru:'Общ. транспорт',he:'תח"צ',en:'Public Transit'}, icon:'navigation' },
    ]},
  { id: 'health', name: { ru:'Здоровье', he:'בריאות', en:'Health' }, icon: 'heart', color: '#f472b6',
    subs: [
      { id:'doctor', name:{ru:'Врач',he:'רופא',en:'Doctor'}, icon:'heart' },
      { id:'pharmacy', name:{ru:'Аптека',he:'בית מרקחת',en:'Pharmacy'}, icon:'plus-circle' },
      { id:'dentist', name:{ru:'Стоматолог',he:'רופא שיניים',en:'Dentist'}, icon:'smile' },
      { id:'health_insurance', name:{ru:'Мед. страховка',he:'ביטוח בריאות',en:'Health Insurance'}, icon:'shield' },
    ]},
  { id: 'entertainment', name: { ru:'Развлечения', he:'בילויים', en:'Entertainment' }, icon: 'film', color: '#22d3ee',
    subs: [
      { id:'movies', name:{ru:'Кино',he:'קולנוע',en:'Movies'}, icon:'film' },
      { id:'subscriptions', name:{ru:'Подписки',he:'מנויים',en:'Subscriptions'}, icon:'layers' },
      { id:'hobbies', name:{ru:'Хобби',he:'תחביבים',en:'Hobbies'}, icon:'star' },
      { id:'sports', name:{ru:'Спорт',he:'ספורט',en:'Sports'}, icon:'target' },
    ]},
  { id: 'travel', name: { ru:'Путешествия', he:'נסיעות', en:'Travel' }, icon: 'globe', color: '#2dd4bf',
    subs: [
      { id:'flights', name:{ru:'Авиабилеты',he:'טיסות',en:'Flights'}, icon:'navigation' },
      { id:'hotels', name:{ru:'Гостиницы',he:'מלונות',en:'Hotels'}, icon:'home' },
      { id:'travel_food', name:{ru:'Еда в поездке',he:'אוכל בנסיעה',en:'Travel Food'}, icon:'coffee' },
    ]},
  { id: 'kids', name: { ru:'Дети', he:'ילדים', en:'Kids' }, icon: 'smile', color: '#a78bfa',
    subs: [
      { id:'school', name:{ru:'Школа/садик',he:'בית ספר/גן',en:'School'}, icon:'book-open' },
      { id:'kids_clothes', name:{ru:'Одежда детям',he:'ביגוד ילדים',en:'Kids Clothes'}, icon:'shopping-bag' },
      { id:'toys', name:{ru:'Игрушки',he:'צעצועים',en:'Toys'}, icon:'gift' },
      { id:'kids_activities', name:{ru:'Кружки',he:'חוגים',en:'Activities'}, icon:'star' },
    ]},
  { id: 'personal', name: { ru:'Личное', he:'אישי', en:'Personal' }, icon: 'user', color: '#c084fc',
    subs: [
      { id:'clothing', name:{ru:'Одежда',he:'ביגוד',en:'Clothing'}, icon:'shopping-bag' },
      { id:'cosmetics', name:{ru:'Косметика',he:'קוסמטיקה',en:'Cosmetics'}, icon:'scissors' },
      { id:'gifts', name:{ru:'Подарки',he:'מתנות',en:'Gifts'}, icon:'gift' },
    ]},
  { id: 'income_group', name: { ru:'Доходы', he:'הכנסות', en:'Income' }, icon: 'briefcase', color: '#34d399',
    subs: [
      { id:'salary_me', name:{ru:'Зарплата',he:'משכורת',en:'Salary'}, icon:'briefcase' },
      { id:'salary_spouse', name:{ru:'Зарплата (супруг)',he:'משכורת (בן/בת זוג)',en:'Salary (spouse)'}, icon:'briefcase' },
      { id:'rental_income', name:{ru:'Аренда',he:'שכירות',en:'Rental'}, icon:'home' },
      { id:'handyman', name:{ru:'Подработка',he:'עבודה נוספת',en:'Side Job'}, icon:'tool' },
      { id:'sales', name:{ru:'Продажи',he:'מכירות',en:'Sales'}, icon:'package' },
      { id:'keren_hishtalmut', name:{ru:'Керен иштальмут',he:'קרן השתלמות',en:'Study Fund'}, icon:'trending-up' },
      { id:'pension', name:{ru:'Пенсия',he:'פנסיה',en:'Pension'}, icon:'umbrella' },
    ]},
];

function anyName(nameObj, lang) {
  if (!nameObj) return null;
  return nameObj[lang] || nameObj.en || nameObj.ru || nameObj.he || Object.values(nameObj)[0] || null;
}

export function getCatName(id, groups, lang) {
  // Try i18n first
  const translated = i18n.t(id);
  if (translated !== id) return translated;
  // Search in groups — fallback to any available language
  for (const g of groups) {
    if (g.id === id && g.name) return anyName(g.name, lang) || id;
    for (const s of (g.subs || [])) {
      if (s.id === id && s.name) return anyName(s.name, lang) || id;
    }
  }
  return id;
}

// Render icon that may be a Feather name or an 'ion:*' Ionicons name
export function CatIcon({ icon, size, color }) {
  if (icon && icon.startsWith('ion:')) return <Ionicons name={icon.slice(4)} size={size} color={color} />;
  return <Feather name={icon} size={size} color={color} />;
}

export function getCatIcon(id, groups) {
  const cfg = categoryConfig[id];
  if (cfg) return { icon: cfg.icon, color: cfg.color };
  for (const g of groups) {
    if (g.id === id) return { icon: g.icon, color: g.color };
    for (const s of (g.subs || [])) {
      if (s.id === id) return { icon: s.icon, color: g.color };
    }
  }
  return { icon: 'circle', color: '#64748b' };
}

export default function CategoryPickerModal({ visible, onClose, onSelect, type = 'expense' }) {
  const [groups, setGroups] = useState([]);
  const [topCats, setTopCats] = useState([]);
  const [search, setSearch] = useState('');
  // groupId currently in inline-create mode; null when no group is creating.
  const [creatingGroup, setCreatingGroup] = useState(null);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('tag');
  const lang = i18n.getLanguage();
  const st = createSt();

  useEffect(() => {
    if (!visible) return;
    setSearch('');
    setCreatingGroup(null);
    setNewName('');
    setNewIcon('tag');
    Promise.all([dataService.getCategories(), dataService.getTransactions()]).then(([saved, txs]) => {
      const g = saved && saved.length > 0 ? saved : DEFAULT_GROUPS;
      setGroups(g);

      // Top 5 most used in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recent = txs.filter(t => {
        if (type === 'income' && t.type !== 'income') return false;
        if (type === 'expense' && t.type !== 'expense') return false;
        const d = new Date(t.date || t.createdAt);
        return d >= thirtyDaysAgo;
      });
      const counts = {};
      recent.forEach(t => { counts[t.categoryId] = (counts[t.categoryId] || 0) + 1; });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
      setTopCats(sorted);
    });
  }, [visible, type]);

  // Filter groups by type
  const incomeIds = ['salary_me', 'salary_spouse', 'rental_income', 'handyman', 'sales', 'other_income'];
  const filteredGroups = groups.filter(g => {
    if (type === 'income') return g.id === 'income_group';
    return g.id !== 'income_group';
  });

  // Build flat list for search
  const allCats = [];
  filteredGroups.forEach(g => {
    (g.subs || []).forEach(s => {
      allCats.push({ id: s.id, name: getCatName(s.id, groups, lang), ...getCatIcon(s.id, groups), groupName: g.name?.[lang] || g.name?.en });
    });
    // Also add group itself as selectable if it has an id in categoryConfig
    if (categoryConfig[g.id]) {
      allCats.push({ id: g.id, name: getCatName(g.id, groups, lang), ...getCatIcon(g.id, groups), groupName: '' });
    }
  });

  const searchResults = search.trim()
    ? allCats.filter(c => c.name.toLowerCase().includes(search.trim().toLowerCase()))
    : null;

  const handleSelect = (catId, latestGroups) => {
    // Pass updated groups back when we just created the category — the
    // caller (AddTransactionModal / AddRecurringModal) seeded its catGroups
    // state when it opened, so without this it can't resolve the name and
    // would render the raw id (e.g. "ремонт_yos3").
    onSelect(catId, latestGroups);
    onClose();
  };

  // Inline create — appends a new sub to the chosen group, persists,
  // and immediately selects the freshly-created category so the user
  // doesn't have to dig back through the picker tree.
  const handleCreateSub = async (groupId) => {
    const name = newName.trim();
    if (!name) return;
    // Pure-ASCII id so the document key never carries non-Latin chars even
    // for Cyrillic / Hebrew / CJK names. Display name lives in `name`.
    const id = 'cat_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    // If local groups state hasn't loaded yet, re-read from storage instead
    // of falling back to DEFAULT_GROUPS — saving DEFAULT_GROUPS would wipe
    // any custom categories the user already had. This was the root cause of
    // the "Categories screen empty after creating a category" report.
    let baseGroups = groups;
    if (!Array.isArray(baseGroups) || baseGroups.length === 0) {
      try {
        const saved = await dataService.getCategories();
        baseGroups = (Array.isArray(saved) && saved.length > 0) ? saved : DEFAULT_GROUPS;
      } catch (e) {
        baseGroups = DEFAULT_GROUPS;
      }
    }

    const next = baseGroups.map(g => {
      if (g.id !== groupId) return g;
      const subs = Array.isArray(g.subs) ? g.subs.slice() : [];
      subs.push({ id, name: { [lang]: name }, icon: newIcon || 'tag' });
      return { ...g, subs };
    });
    setGroups(next);
    // Update the module-level cache so CategoryIcon and any other consumer
    // sees the new sub immediately, without waiting for its next refetch.
    setCachedGroups(next);
    try {
      await dataService.saveCategories(next);
    } catch (e) {
      captureError(e, { where: 'CategoryPickerModal.handleCreateSub.saveCategories', groupId, baseLen: baseGroups.length });
    }
    setCreatingGroup(null);
    setNewName('');
    setNewIcon('tag');
    handleSelect(id, next);
  };

  const renderCatButton = (catId, size = 'normal') => {
    const { icon, color } = getCatIcon(catId, groups);
    const name = getCatName(catId, groups, lang);
    return (
      <TouchableOpacity key={catId} style={[st.catBtn, size === 'top' && st.catBtnTop]}
        onPress={() => handleSelect(catId)} activeOpacity={0.7}>
        <View style={[st.catIcon, { backgroundColor: color + '18' }]}>
          <CatIcon icon={icon} size={size === 'top' ? 22 : 18} color={color} />
        </View>
        <Text style={st.catName} numberOfLines={1}>{name}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SwipeModal visible={visible} onClose={onClose}>
      <View style={st.container}>
        <Text style={st.title}>{i18n.t('category')}</Text>

        {/* Top used */}
        {topCats.length > 0 && !search.trim() && (
          <View style={st.topSection}>
            <Text style={st.sectionLabel}>{i18n.t('frequentlyUsed')}</Text>
            <View style={st.topGrid}>
              {topCats.map(id => renderCatButton(id, 'top'))}
            </View>
          </View>
        )}

        {/* Search */}
        <View style={st.searchRow}>
          <Feather name="search" size={16} color={colors.textMuted} />
          <TextInput style={st.searchInput} value={search} onChangeText={setSearch}
            placeholder={i18n.t('search')} placeholderTextColor={colors.textMuted} />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Feather name="x" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Search results */}
        {searchResults ? (
          <ScrollView style={st.list} showsVerticalScrollIndicator={false}>
            {searchResults.length === 0 ? (
              <Text style={st.emptyText}>{i18n.t('noResults')}</Text>
            ) : (
              searchResults.map(cat => (
                <TouchableOpacity key={cat.id} style={st.listRow} onPress={() => handleSelect(cat.id)} activeOpacity={0.7}>
                  <View style={[st.listIcon, { backgroundColor: cat.color + '18' }]}>
                    <CatIcon icon={cat.icon} size={18} color={cat.color} />
                  </View>
                  <View style={st.listInfo}>
                    <Text style={st.listName}>{cat.name}</Text>
                    {cat.groupName ? <Text style={st.listGroup}>{cat.groupName}</Text> : null}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        ) : (
          /* Full list by groups */
          <ScrollView style={st.list} showsVerticalScrollIndicator={false}>
            {filteredGroups.map(g => (
              <View key={g.id} style={st.groupSection}>
                <Text style={[st.groupTitle, { color: g.color }]}>
                  {g.name?.[lang] || g.name?.en || g.id}
                </Text>
                {(g.subs || []).map(s => {
                  const { icon, color } = getCatIcon(s.id, groups);
                  const name = getCatName(s.id, groups, lang);
                  return (
                    <TouchableOpacity key={s.id} style={st.listRow} onPress={() => handleSelect(s.id)} activeOpacity={0.7}>
                      <View style={[st.listIcon, { backgroundColor: color + '18' }]}>
                        <CatIcon icon={icon} size={18} color={color} />
                      </View>
                      <Text style={st.listName}>{name}</Text>
                    </TouchableOpacity>
                  );
                })}

                {creatingGroup === g.id ? (
                  <View style={st.createBlock}>
                    <View style={st.listRow}>
                      <View style={[st.listIcon, { backgroundColor: g.color + '18' }]}>
                        <Feather name={newIcon} size={18} color={g.color} />
                      </View>
                      <TextInput
                        style={[st.listName, { flex: 1, padding: 0 }]}
                        value={newName}
                        onChangeText={setNewName}
                        placeholder={i18n.t('newCategory') || 'New category'}
                        placeholderTextColor={colors.textMuted}
                        autoFocus
                        returnKeyType="done"
                        onSubmitEditing={() => handleCreateSub(g.id)}
                      />
                      <TouchableOpacity onPress={() => handleCreateSub(g.id)} style={{ padding: 6 }} disabled={!newName.trim()}>
                        <Feather name="check" size={18} color={newName.trim() ? colors.green : colors.textMuted} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => { setCreatingGroup(null); setNewName(''); setNewIcon('tag'); }} style={{ padding: 6 }}>
                        <Feather name="x" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.iconStrip} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                      {PICKER_ICONS.map(ic => {
                        const sel = ic === newIcon;
                        return (
                          <TouchableOpacity key={ic}
                            onPress={() => setNewIcon(ic)}
                            style={[st.iconBtn, sel && { backgroundColor: g.color + '25', borderColor: g.color }]}
                          >
                            <Feather name={ic} size={18} color={sel ? g.color : colors.textDim} />
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[st.listRow, { borderBottomWidth: 0 }]}
                    onPress={() => { setCreatingGroup(g.id); setNewName(''); }}
                    activeOpacity={0.7}
                  >
                    <View style={[st.listIcon, { backgroundColor: g.color + '10', borderWidth: 1, borderColor: g.color + '40', borderStyle: 'dashed' }]}>
                      <Feather name="plus" size={18} color={g.color} />
                    </View>
                    <Text style={[st.listName, { color: g.color }]}>{i18n.t('addCategory') || '+ Add'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </SwipeModal>
  );
}

const SCREEN_H = Dimensions.get('window').height;

const createSt = () => StyleSheet.create({
  container: { flex: 1, maxHeight: Math.round(SCREEN_H * 0.85) },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 16 },

  topSection: { marginBottom: 16 },
  sectionLabel: { color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10 },
  topGrid: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  catBtn: { alignItems: 'center', gap: 6, width: 62 },
  catBtnTop: { width: 62 },
  catIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  catName: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', textAlign: 'center' },

  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, gap: 10, borderWidth: 1, borderColor: colors.cardBorder },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, padding: 0 },

  list: { flex: 1 },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 20 },

  groupSection: { marginBottom: 16 },
  groupTitle: { fontSize: 12, fontWeight: '700', marginBottom: 8 },

  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  listIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  listInfo: { flex: 1 },
  listName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  listGroup: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

  createBlock: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconStrip: { paddingVertical: 4, marginBottom: 8 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: 'transparent',
  },
});
