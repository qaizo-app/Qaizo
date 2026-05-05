// src/screens/ProjectsScreen.js
// Управление проектами: создание, редактирование, удаление
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ColorPickerRow from '../components/ColorPickerRow';
import ConfirmModal from '../components/ConfirmModal';
import IconGrid from '../components/IconGrid';
import SwipeModal from '../components/SwipeModal';
import i18n from '../i18n';
import dataService from '../services/dataService';
import Amount from '../components/Amount';
import { colors } from '../theme/colors';
import { sym } from '../utils/currency';

const ICON_OPTIONS = [
  'folder','map-pin','home','shopping-cart','briefcase','gift','heart',
  'star','flag','target','globe','sun','umbrella','camera','music',
  'truck','tool','package','award','layers','coffee','book-open',
  'users','zap','shield','cpu','smartphone','key','archive','box',
  'navigation','droplet','dollar-sign','credit-card','trending-up',
  'activity','scissors','monitor','tv','phone','tag','compass',
];

const COLOR_OPTIONS = [
  '#fb7185','#f97316','#f59e0b','#fbbf24','#a3e635','#34d399','#2dd4bf',
  '#22d3ee','#60a5fa','#818cf8','#a78bfa','#c084fc','#f472b6','#ec4899',
  '#ef4444','#64748b',
];

// Ready-made project presets — one tap to fill name + icon + color + suggested budget
const PROJECT_PRESETS = [
  { key: 'renovation', icon: 'tool',          color: '#f97316', budget: 30000 },
  { key: 'trip',       icon: 'map-pin',       color: '#22d3ee', budget: 5000  },
  { key: 'wedding',    icon: 'heart',         color: '#f472b6', budget: 50000 },
  { key: 'car',        icon: 'truck',         color: '#60a5fa', budget: 8000  },
  { key: 'gifts',      icon: 'gift',          color: '#a78bfa', budget: 1500  },
  { key: 'baby',       icon: 'smile',         color: '#fbbf24', budget: 6000  },
];

export default function ProjectsScreen() {
  const navigation = useNavigation();
  const [projects, setProjects] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [longPressTarget, setLongPressTarget] = useState(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('folder');
  const [selColor, setSelColor] = useState(COLOR_OPTIONS[0]);
  const [budget, setBudget] = useState('');
  const st = createSt();

  const loadData = async () => {
    const [p, t] = await Promise.all([
      dataService.getProjects(),
      dataService.getTransactions(),
    ]);
    setProjects(p);
    setTransactions(t);
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const openAdd = () => {
    setEditProject(null);
    setName('');
    setIcon('folder');
    setSelColor(COLOR_OPTIONS[0]);
    setBudget('');
    setShowModal(true);
  };

  const openEdit = (proj) => {
    setEditProject(proj);
    setName(proj.name);
    setIcon(proj.icon || 'folder');
    setSelColor(proj.color || COLOR_OPTIONS[0]);
    setBudget(proj.budget ? String(proj.budget) : '');
    setShowModal(true);
  };

  const applyPreset = (preset) => {
    setName(i18n.t(`projectPreset_${preset.key}`));
    setIcon(preset.icon);
    setSelColor(preset.color);
    setBudget(String(preset.budget));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    const budgetNum = parseFloat(String(budget).replace(/[^\d.]/g, '')) || 0;
    const data = { name: name.trim(), icon, color: selColor, budget: budgetNum };
    if (editProject) {
      await dataService.updateProject(editProject.id, data);
    } else {
      await dataService.addProject(data);
    }
    setShowModal(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await dataService.deleteProject(deleteTarget.id);
    setDeleteTarget(null);
    loadData();
  };

  const getProjectTotal = (projectId) => {
    return transactions
      .filter(t => t.projectId === projectId)
      .reduce((sum, t) => sum + (t.type === 'expense' ? t.amount : -t.amount), 0);
  };

  const getProjectTxCount = (projectId) => {
    return transactions.filter(t => t.projectId === projectId).length;
  };

  return (
    <View style={st.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={st.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
            <Feather name={i18n.backIcon()} size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={st.title}>{i18n.t('projects')}</Text>
          <TouchableOpacity style={st.addBtn} onPress={openAdd}>
            <Feather name="plus" size={22} color={colors.bg} />
          </TouchableOpacity>
        </View>

        {projects.length === 0 && (
          <View style={st.empty}>
            <Feather name="folder" size={48} color={colors.textMuted} />
            <Text style={st.emptyText}>{i18n.t('noProjects')}</Text>
            <Text style={st.emptyHint}>{i18n.t('projectsEmptyHint')}</Text>
            <TouchableOpacity style={st.emptyBtn} onPress={openAdd} activeOpacity={0.85}>
              <Feather name="plus" size={16} color={colors.bg} />
              <Text style={st.emptyBtnText}>{i18n.t('createFirstProject')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {projects.map(proj => {
          const total = getProjectTotal(proj.id);
          const count = getProjectTxCount(proj.id);
          const budgetVal = proj.budget || 0;
          const pct = budgetVal > 0 ? Math.min(100, Math.round((total / budgetVal) * 100)) : 0;
          const overBudget = budgetVal > 0 && total > budgetVal;
          const barColor = overBudget ? colors.red : pct >= 80 ? '#f59e0b' : (proj.color || '#60a5fa');
          return (
            <TouchableOpacity key={proj.id} style={st.projectRow}
              onPress={() => navigation.getParent()?.navigate('Transactions', { filterProject: proj.id })}
              onLongPress={() => setLongPressTarget(proj)} activeOpacity={0.7}>
              <View style={[st.projectIcon, { backgroundColor: (proj.color || '#60a5fa') + '20' }]}>
                <Feather name={proj.icon || 'folder'} size={22} color={proj.color || '#60a5fa'} />
              </View>
              <View style={st.projectInfo}>
                <Text style={st.projectName}>{proj.name}</Text>
                {budgetVal > 0 ? (
                  <>
                    <View style={st.budgetRow}>
                      <Amount value={total} style={[st.projectMeta, overBudget && { color: colors.red, fontWeight: '700' }]} />
                      <Text style={st.budgetSep}> / </Text>
                      <Amount value={budgetVal} style={st.projectMetaDim} />
                      <Text style={[st.budgetPct, { color: barColor }]}>  {pct}%</Text>
                    </View>
                    <View style={st.progressTrack}>
                      <View style={[st.progressFill, { width: `${Math.min(100, pct)}%`, backgroundColor: barColor }]} />
                    </View>
                  </>
                ) : (
                  <Text style={st.projectMeta}>
                    {count} {i18n.t('transactions').toLowerCase()} · <Amount value={total} style={st.projectMeta} />
                  </Text>
                )}
              </View>
              <Feather name={i18n.chevronRight()} size={18} color={colors.textMuted} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Add/Edit Modal */}
      <SwipeModal visible={showModal} onClose={() => setShowModal(false)} title={editProject ? i18n.t('project') : i18n.t('newProject')}>
        <View style={{ flex: 1 }}>
          <ScrollView style={st.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {!editProject && (
              <>
                <Text style={st.label}>{i18n.t('presets')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.presetsRow}>
                  {PROJECT_PRESETS.map(p => (
                    <TouchableOpacity key={p.key} style={[st.presetChip, { borderColor: p.color + '60', backgroundColor: p.color + '14' }]}
                      onPress={() => applyPreset(p)} activeOpacity={0.7}>
                      <Feather name={p.icon} size={14} color={p.color} />
                      <Text style={[st.presetChipTxt, { color: p.color }]}>{i18n.t(`projectPreset_${p.key}`)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <Text style={[st.label, !editProject && { marginTop: 20 }]}>{i18n.t('projectName')}</Text>
            <TextInput style={st.input} value={name} onChangeText={setName}
              placeholder={i18n.t('projectName')} placeholderTextColor={colors.textMuted}
              autoFocus />

            <Text style={st.label}>{i18n.t('budget')} ({i18n.t('optional')})</Text>
            <TextInput style={st.input} value={budget} onChangeText={setBudget}
              placeholder={`0 ${sym()}`} placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad" />

            <Text style={st.label}>{i18n.t('icon')}</Text>
            <IconGrid icons={ICON_OPTIONS} selected={icon} color={selColor} onSelect={setIcon} />

            <Text style={[st.label, { marginTop: 16 }]}>{i18n.t('color')}</Text>
            <ColorPickerRow selected={selColor} onSelect={setSelColor} />
          </ScrollView>

          <View style={st.btnRow}>
            <TouchableOpacity style={st.cancelBtn} onPress={() => setShowModal(false)}>
              <Text style={st.cancelBtnText}>{i18n.t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.saveBtn, { backgroundColor: selColor }]} onPress={handleSave}>
              <Feather name="check" size={18} color={colors.bg} />
              <Text style={st.saveBtnText}>{i18n.t('save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SwipeModal>

      {/* Long press menu */}
      {longPressTarget && !deleteTarget && (
        <TouchableOpacity style={st.overlay} activeOpacity={1} onPress={() => setLongPressTarget(null)}>
          <View style={st.actionSheet}>
            <Text style={st.actionTitle}>{longPressTarget.name}</Text>
            <TouchableOpacity style={st.actionBtn} onPress={() => { const p = longPressTarget; setLongPressTarget(null); openEdit(p); }}>
              <Feather name="edit-2" size={18} color={colors.blue} />
              <Text style={st.actionBtnText}>{i18n.t('edit')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.actionBtn} onPress={() => { setDeleteTarget(longPressTarget); setLongPressTarget(null); }}>
              <Feather name="trash-2" size={18} color={colors.red} />
              <Text style={[st.actionBtnText, { color: colors.red }]}>{i18n.t('delete')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.actionCancelBtn} onPress={() => setLongPressTarget(null)}>
              <Text style={st.actionCancelText}>{i18n.t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      <ConfirmModal visible={!!deleteTarget}
        title={i18n.t('delete')}
        message={deleteTarget?.name || ''}
        confirmText={i18n.t('delete')} cancelText={i18n.t('cancel')}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)}
        icon="trash-2" />
    </View>
  );
}

const createSt = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  addBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center' },

  empty: { alignItems: 'center', marginTop: 80, gap: 12, paddingHorizontal: 32 },
  emptyText: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 4 },
  emptyHint: { color: colors.textMuted, fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 18 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.green, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14, marginTop: 12 },
  emptyBtnText: { color: colors.bg, fontSize: 14, fontWeight: '700' },

  projectRow: { flexDirection: i18n.row(), alignItems: 'center', marginHorizontal: 20, marginTop: 12, backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.cardBorder, gap: 14 },
  projectIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  projectInfo: { flex: 1 },
  projectName: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 4, textAlign: i18n.textAlign() },
  projectMeta: { color: colors.textDim, fontSize: 12, fontWeight: '500' },
  projectMetaDim: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  budgetRow: { flexDirection: i18n.row(), alignItems: 'center', marginBottom: 6 },
  budgetSep: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  budgetPct: { fontSize: 11, fontWeight: '700' },
  progressTrack: { height: 4, backgroundColor: colors.bg2, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  presetsRow: { flexDirection: 'row', gap: 8, paddingVertical: 4, paddingHorizontal: 2 },
  presetChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  presetChipTxt: { fontSize: 13, fontWeight: '600' },

  form: { paddingHorizontal: 24, paddingBottom: 30 },
  label: { color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  input: { color: colors.text, fontSize: 16, backgroundColor: colors.bg2, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: colors.cardBorder },

  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg2, borderWidth: 1.5, borderColor: 'transparent' },

  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: 'transparent' },
  colorBtnActive: { borderColor: colors.text, transform: [{ scale: 1.15 }] },

  btnRow: { flexDirection: 'row', gap: 12, paddingVertical: 12, paddingHorizontal: 4 },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, alignItems: 'center' },
  cancelBtnText: { color: colors.textDim, fontSize: 16, fontWeight: '600' },
  saveBtn: { flex: 2, flexDirection: 'row', paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 6 },
  saveBtnText: { color: colors.bg, fontSize: 16, fontWeight: '700' },

  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 100 },
  actionSheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  actionTitle: { color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.divider },
  actionBtnText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  actionCancelBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 8, borderRadius: 14, backgroundColor: colors.bg2 },
  actionCancelText: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
});
