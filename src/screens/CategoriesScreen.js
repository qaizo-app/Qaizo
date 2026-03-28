// src/screens/CategoriesScreen.js
// Управление категориями: группы + подкатегории, добавление, редактирование
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ConfirmModal from '../components/ConfirmModal';
import SwipeModal from '../components/SwipeModal';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { colors } from '../theme/colors';

const ICON_OPTIONS = [
  'home','shopping-cart','coffee','navigation','droplet','heart','smartphone',
  'zap','shopping-bag','smile','film','book-open','scissors','cpu','shield',
  'key','map-pin','users','briefcase','tool','package','plus-circle',
  'truck','gift','music','camera','sun','moon','umbrella','star',
  'globe','award','target','flag','layers','grid','box','archive',
];

const COLOR_OPTIONS = [
  '#fb7185','#f97316','#f59e0b','#fbbf24','#a3e635','#34d399','#2dd4bf',
  '#22d3ee','#60a5fa','#818cf8','#a78bfa','#c084fc','#f472b6','#ec4899',
  '#ef4444','#64748b',
];

const DEFAULT_GROUPS = [
  { id: 'home', name: { ru:'Дом', he:'בית', en:'Home' }, icon: 'home', color: '#60a5fa',
    subs: [
      { id:'electricity', name:{ru:'Электричество',he:'חשמל',en:'Electricity'}, icon:'zap' },
      { id:'water', name:{ru:'Вода',he:'מים',en:'Water'}, icon:'droplet' },
      { id:'gas', name:{ru:'Газ',he:'גז',en:'Gas'}, icon:'sun' },
      { id:'arnona', name:{ru:'Арнона',he:'ארנונה',en:'Property Tax'}, icon:'map-pin' },
      { id:'vaad', name:{ru:'Ваад байт',he:'ועד בית',en:'Building Fee'}, icon:'users' },
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
    ]},
];

export default function CategoriesScreen() {
  const navigation = useNavigation();
  const [groups, setGroups] = useState([]);

  useFocusEffect(useCallback(() => {
    dataService.getCategories().then(saved => {
      setGroups(saved && saved.length > 0 ? saved : DEFAULT_GROUPS);
    });
  }, []));

  const persistGroups = (newGroups) => {
    setGroups(newGroups);
    dataService.saveCategories(newGroups);
  };
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editParent, setEditParent] = useState(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('circle');
  const [editColor, setEditColor] = useState('#60a5fa');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const lang = i18n.getLanguage();
  const styles = createStyles();

  const toggleGroup = (id) => setExpandedGroup(expandedGroup === id ? null : id);
  const getName = (nameObj) => {
    if (typeof nameObj === 'string') return nameObj;
    return nameObj?.[lang] || nameObj?.en || '';
  };

  const openAddGroup = () => {
    setEditItem(null); setEditParent(null); setEditName(''); setEditIcon('grid'); setEditColor('#60a5fa'); setShowEdit(true);
  };
  const openAddSub = (group) => {
    setEditItem(null); setEditParent(group); setEditName(''); setEditIcon('circle'); setEditColor(group.color); setShowEdit(true);
  };
  const openEditGroup = (group) => {
    setEditItem(group); setEditParent(null); setEditName(getName(group.name)); setEditIcon(group.icon); setEditColor(group.color); setShowEdit(true);
  };
  const openEditSub = (sub, group) => {
    setEditItem(sub); setEditParent(group); setEditName(getName(sub.name)); setEditIcon(sub.icon); setEditColor(group.color); setShowEdit(true);
  };

  const handleSave = () => {
    if (!editName.trim()) return;
    const newGroups = [...groups];
    if (editParent) {
      // Sub-category
      const gIdx = newGroups.findIndex(g => g.id === editParent.id);
      if (gIdx === -1) return;
      if (editItem) {
        // Edit existing sub
        const sIdx = newGroups[gIdx].subs.findIndex(s => s.id === editItem.id);
        if (sIdx !== -1) newGroups[gIdx].subs[sIdx] = { ...newGroups[gIdx].subs[sIdx], name: { ...newGroups[gIdx].subs[sIdx].name, [lang]: editName.trim() }, icon: editIcon };
      } else {
        // Add new sub
        const id = editName.trim().toLowerCase().replace(/\s+/g, '_') + '_' + Date.now().toString(36).slice(-4);
        newGroups[gIdx].subs.push({ id, name: { [lang]: editName.trim() }, icon: editIcon });
      }
    } else {
      if (editItem) {
        // Edit group
        const gIdx = newGroups.findIndex(g => g.id === editItem.id);
        if (gIdx !== -1) {
          newGroups[gIdx] = { ...newGroups[gIdx], name: { ...newGroups[gIdx].name, [lang]: editName.trim() }, icon: editIcon, color: editColor };
        }
      } else {
        // Add new group
        const id = editName.trim().toLowerCase().replace(/\s+/g, '_') + '_' + Date.now().toString(36).slice(-4);
        newGroups.push({ id, name: { [lang]: editName.trim() }, icon: editIcon, color: editColor, subs: [] });
      }
    }
    persistGroups(newGroups);
    setShowEdit(false);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    let newGroups = [...groups];
    if (deleteTarget.parentId) {
      const gIdx = newGroups.findIndex(g => g.id === deleteTarget.parentId);
      if (gIdx !== -1) newGroups[gIdx].subs = newGroups[gIdx].subs.filter(s => s.id !== deleteTarget.id);
    } else {
      newGroups = newGroups.filter(g => g.id !== deleteTarget.id);
    }
    persistGroups(newGroups);
    setDeleteTarget(null);
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Feather name={i18n.isRTL() ? "arrow-right" : "arrow-left"} size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{i18n.t('categories')}</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openAddGroup}>
            <Feather name="plus" size={20} color={colors.bg} />
          </TouchableOpacity>
        </View>

        {groups.map(group => (
          <View key={group.id}>
            {/* Group header */}
            <TouchableOpacity style={styles.groupRow} onPress={() => toggleGroup(group.id)} onLongPress={() => openEditGroup(group)}>
              <View style={[styles.groupIcon, { backgroundColor: `${group.color}18` }]}>
                <Feather name={group.icon} size={18} color={group.color} />
              </View>
              <Text style={styles.groupName}>{getName(group.name)}</Text>
              <Text style={styles.subCount}>{group.subs.length}</Text>
              <Feather name={expandedGroup === group.id ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Sub-categories */}
            {expandedGroup === group.id && (
              <View style={styles.subsContainer}>
                {group.subs.map(sub => (
                  <TouchableOpacity key={sub.id} style={styles.subRow} onPress={() => openEditSub(sub, group)}
                    onLongPress={() => setDeleteTarget({ id: sub.id, parentId: group.id, name: getName(sub.name) })}>
                    <View style={[styles.subIcon, { backgroundColor: `${group.color}10` }]}>
                      <Feather name={sub.icon} size={14} color={group.color} />
                    </View>
                    <Text style={styles.subName}>{getName(sub.name)}</Text>
                    <Feather name="edit-2" size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.addSubBtn} onPress={() => openAddSub(group)}>
                  <Feather name="plus" size={16} color={group.color} />
                  <Text style={[styles.addSubText, { color: group.color }]}>
                    {i18n.t('add')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Edit modal */}
      <SwipeModal visible={showEdit} onClose={() => setShowEdit(false)}>
        {({ close }) => (
          <ScrollView showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 20 }}>
            <Text style={styles.modalTitle}>
              {editItem ? i18n.t('edit') : i18n.t('add')}
              {editParent ? ` → ${getName(editParent.name)}` : ''}
            </Text>

            <Text style={styles.fieldLabel}>{i18n.t('name')}</Text>
            <TextInput style={styles.input} value={editName} onChangeText={setEditName}
              placeholder={i18n.t('categoryName')}
              placeholderTextColor={colors.textMuted} />

            <Text style={styles.fieldLabel}>{i18n.t('icon')}</Text>
            <View style={styles.iconGrid}>
              {ICON_OPTIONS.map(ic => (
                <TouchableOpacity key={ic} style={[styles.iconBtn, editIcon === ic && { borderColor: editColor, backgroundColor: `${editColor}15` }]}
                  onPress={() => setEditIcon(ic)}>
                  <Feather name={ic} size={18} color={editIcon === ic ? editColor : colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>

            {!editParent && (
              <>
                <Text style={styles.fieldLabel}>{i18n.t('color')}</Text>
                <View style={styles.colorGrid}>
                  {COLOR_OPTIONS.map(c => (
                    <TouchableOpacity key={c} style={[styles.colorBtn, { backgroundColor: c }, editColor === c && styles.colorBtnActive]}
                      onPress={() => setEditColor(c)} />
                  ))}
                </View>
              </>
            )}

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={close}>
                <Text style={styles.cancelText}>{i18n.t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: editColor }]} onPress={handleSave}>
                <Feather name="check" size={18} color="#fff" />
                <Text style={styles.saveText}> {i18n.t('save')}</Text>
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
  header: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 16 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', flex: 1, textAlign: 'center' },
  addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center' },

  groupRow: { flexDirection: i18n.row(), alignItems: 'center', marginHorizontal: 20, marginTop: 8, backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.cardBorder, gap: 10 },
  groupIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  groupName: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '600', textAlign: i18n.textAlign() },
  subCount: { color: colors.textMuted, fontSize: 13, fontWeight: '600', backgroundColor: colors.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },

  subsContainer: { marginHorizontal: 20, marginTop: 4, backgroundColor: colors.card, borderRadius: 14, padding: 8, borderWidth: 1, borderColor: colors.cardBorder },
  subRow: { flexDirection: i18n.row(), alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 10 },
  subIcon: { width: 32, height: 32, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  subName: { flex: 1, color: colors.textSecondary, fontSize: 14, fontWeight: '500', textAlign: i18n.textAlign() },

  addSubBtn: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'center', padding: 12, gap: 6 },
  addSubText: { fontSize: 13, fontWeight: '600' },

  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 20, textAlign: i18n.textAlign() },
  fieldLabel: { color: colors.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8, marginTop: 8, textAlign: i18n.textAlign() },
  input: { backgroundColor: colors.card, borderRadius: 14, padding: 14, color: colors.text, fontSize: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.cardBorder, textAlign: i18n.textAlign() },

  iconGrid: { flexDirection: i18n.row(), flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  iconBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },

  colorGrid: { flexDirection: i18n.row(), flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  colorBtn: { width: 32, height: 32, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  colorBtnActive: { borderColor: colors.text, borderWidth: 3 },

  btnRow: { flexDirection: i18n.row(), gap: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.divider },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  cancelText: { color: colors.textDim, fontSize: 16, fontWeight: '600' },
  saveBtn: { flex: 2, flexDirection: i18n.row(), paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});