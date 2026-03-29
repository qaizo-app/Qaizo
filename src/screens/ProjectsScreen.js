// src/screens/ProjectsScreen.js
// Управление проектами: создание, редактирование, удаление
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
import { sym } from '../utils/currency';

const ICON_OPTIONS = [
  'folder','map-pin','home','shopping-cart','briefcase','gift','heart',
  'star','flag','target','globe','sun','umbrella','camera','music',
  'truck','tool','package','award','layers','coffee','book-open',
  'users','zap','shield','cpu','smartphone','key','archive','box',
];

const COLOR_OPTIONS = [
  '#fb7185','#f97316','#f59e0b','#fbbf24','#a3e635','#34d399','#2dd4bf',
  '#22d3ee','#60a5fa','#818cf8','#a78bfa','#c084fc','#f472b6','#ec4899',
  '#ef4444','#64748b',
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
    setShowModal(true);
  };

  const openEdit = (proj) => {
    setEditProject(proj);
    setName(proj.name);
    setIcon(proj.icon || 'folder');
    setSelColor(proj.color || COLOR_OPTIONS[0]);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    if (editProject) {
      await dataService.updateProject(editProject.id, { name: name.trim(), icon, color: selColor });
    } else {
      await dataService.addProject({ name: name.trim(), icon, color: selColor });
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
            <Feather name={'arrow-left'} size={22} color={colors.text} />
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
            <TouchableOpacity style={st.emptyBtn} onPress={openAdd}>
              <Feather name="plus" size={16} color={colors.bg} />
              <Text style={st.emptyBtnText}>{i18n.t('newProject')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {projects.map(proj => {
          const total = getProjectTotal(proj.id);
          const count = getProjectTxCount(proj.id);
          return (
            <TouchableOpacity key={proj.id} style={st.projectRow}
              onPress={() => navigation.getParent()?.navigate('Transactions', { filterProject: proj.id })}
              onLongPress={() => setLongPressTarget(proj)} activeOpacity={0.7}>
              <View style={[st.projectIcon, { backgroundColor: (proj.color || '#60a5fa') + '20' }]}>
                <Feather name={proj.icon || 'folder'} size={22} color={proj.color || '#60a5fa'} />
              </View>
              <View style={st.projectInfo}>
                <Text style={st.projectName}>{proj.name}</Text>
                <Text style={st.projectMeta}>
                  {count} {i18n.t('transactions').toLowerCase()} · {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {sym()}
                </Text>
              </View>
              <Feather name={'chevron-right'} size={18} color={colors.textMuted} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Add/Edit Modal */}
      <SwipeModal visible={showModal} onClose={() => setShowModal(false)} title={editProject ? i18n.t('project') : i18n.t('newProject')}>
        <View style={st.form}>
          <Text style={st.label}>{i18n.t('projectName')}</Text>
          <TextInput style={st.input} value={name} onChangeText={setName}
            placeholder={i18n.t('projectName')} placeholderTextColor={colors.textMuted}
            autoFocus />

          <Text style={st.label}>{i18n.t('icon')}</Text>
          <View style={st.iconGrid}>
            {ICON_OPTIONS.map(ic => (
              <TouchableOpacity key={ic} style={[st.iconBtn, icon === ic && { borderColor: selColor, backgroundColor: selColor + '20' }]}
                onPress={() => setIcon(ic)}>
                <Feather name={ic} size={20} color={icon === ic ? selColor : colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={st.label}>{i18n.t('color')}</Text>
          <View style={st.colorGrid}>
            {COLOR_OPTIONS.map(c => (
              <TouchableOpacity key={c} style={[st.colorBtn, { backgroundColor: c }, selColor === c && st.colorBtnActive]}
                onPress={() => setSelColor(c)} />
            ))}
          </View>

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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center' },

  empty: { alignItems: 'center', marginTop: 80, gap: 16 },
  emptyText: { color: colors.textMuted, fontSize: 16, fontWeight: '500' },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.green, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  emptyBtnText: { color: colors.bg, fontSize: 15, fontWeight: '700' },

  projectRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 12, backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.cardBorder, gap: 14 },
  projectIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  projectInfo: { flex: 1 },
  projectName: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  projectMeta: { color: colors.textDim, fontSize: 13, fontWeight: '500' },

  form: { paddingHorizontal: 24, paddingBottom: 30 },
  label: { color: colors.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  input: { color: colors.text, fontSize: 16, backgroundColor: colors.bg2, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: colors.cardBorder },

  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg2, borderWidth: 1.5, borderColor: 'transparent' },

  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: 'transparent' },
  colorBtnActive: { borderColor: colors.text, transform: [{ scale: 1.15 }] },

  btnRow: { flexDirection: 'row', gap: 12, paddingTop: 24 },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, alignItems: 'center' },
  cancelBtnText: { color: colors.textDim, fontSize: 16, fontWeight: '600' },
  saveBtn: { flex: 2, flexDirection: 'row', paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 6 },
  saveBtnText: { color: colors.bg, fontSize: 16, fontWeight: '700' },

  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 100 },
  actionSheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  actionTitle: { color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.divider },
  actionBtnText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  actionCancelBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 8, borderRadius: 14, backgroundColor: colors.bg2 },
  actionCancelText: { color: colors.textDim, fontSize: 15, fontWeight: '600' },
});
