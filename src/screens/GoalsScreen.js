// src/screens/GoalsScreen.js
// מטרות חיסכון — יצירה, הפקדה, מעקב התקדמות
import React, { useCallback, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Amount from '../components/Amount';
import ConfirmModal from '../components/ConfirmModal';
import DatePickerModal from '../components/DatePickerModal';
import SwipeModal from '../components/SwipeModal';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { colors } from '../theme/colors';
import { sym } from '../utils/currency';

const ICON_OPTIONS = [
  'target','star','globe','home','briefcase','gift','heart',
  'flag','map-pin','sun','umbrella','camera','music',
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

export default function GoalsScreen() {
  const navigation = useNavigation();
  const [goals, setGoals] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [showDeposit, setShowDeposit] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositNote, setDepositNote] = useState('');
  const [longPressTarget, setLongPressTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [weekStart, setWeekStart] = useState('sunday');

  // Form
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('target');
  const [selColor, setSelColor] = useState(COLOR_OPTIONS[0]);
  const [targetAmount, setTargetAmount] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const st = createSt();

  const loadData = async () => {
    const [g, settings] = await Promise.all([dataService.getGoals(), dataService.getSettings()]);
    setGoals(g);
    if (settings.weekStart) setWeekStart(settings.weekStart);
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const openAdd = () => {
    setEditGoal(null); setName(''); setIcon('target'); setSelColor(COLOR_OPTIONS[0]);
    setTargetAmount(''); setInitialAmount(''); setTargetDate('');
    setShowModal(true);
  };

  const openEdit = (goal) => {
    setEditGoal(goal); setName(goal.name); setIcon(goal.icon || 'target');
    setSelColor(goal.color || COLOR_OPTIONS[0]);
    setTargetAmount(String(goal.targetAmount || '')); setInitialAmount(String(goal.initialAmount || ''));
    setTargetDate(goal.targetDate || '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !targetAmount) return;
    const data = {
      name: name.trim(), icon, color: selColor,
      targetAmount: parseFloat(targetAmount) || 0,
      initialAmount: parseFloat(initialAmount) || 0,
      targetDate: targetDate || null,
    };
    if (editGoal) {
      await dataService.updateGoal(editGoal.id, data);
    } else {
      await dataService.addGoal(data);
    }
    setShowModal(false);
    loadData();
  };

  const handleDeposit = async () => {
    if (!showDeposit || !depositAmount) return;
    const amt = parseFloat(depositAmount);
    if (!amt) return;
    await dataService.addGoalDeposit(showDeposit.id, amt, depositNote);
    setShowDeposit(null); setDepositAmount(''); setDepositNote('');
    loadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await dataService.deleteGoal(deleteTarget.id);
    setDeleteTarget(null);
    loadData();
  };

  const getSaved = (goal) => {
    const deposits = (goal.deposits || []).reduce((s, d) => s + d.amount, 0);
    return (goal.initialAmount || 0) + deposits;
  };

  const getMonthlyNeeded = (goal) => {
    const saved = getSaved(goal);
    const remaining = goal.targetAmount - saved;
    if (remaining <= 0) return 0;
    if (!goal.targetDate) return null;
    const now = new Date();
    const target = new Date(goal.targetDate);
    const months = Math.max((target.getFullYear() - now.getFullYear()) * 12 + target.getMonth() - now.getMonth(), 1);
    return Math.ceil(remaining / months);
  };

  const lang = i18n.getLanguage();
  const dd = targetDate ? (() => { const [y, m, d] = targetDate.split('-'); return `${d}.${m}.${y}`; })() : '';

  return (
    <View style={st.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={st.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
            <Feather name={i18n.backIcon()} size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={st.title}>{i18n.t('goals')}</Text>
          <TouchableOpacity style={st.addBtn} onPress={openAdd}>
            <Feather name="plus" size={22} color={colors.bg} />
          </TouchableOpacity>
        </View>

        {goals.length === 0 && (
          <View style={st.empty}>
            <Feather name="target" size={48} color={colors.textMuted} />
            <Text style={st.emptyText}>{i18n.t('noGoals')}</Text>
          </View>
        )}

        {goals.map(goal => {
          const saved = getSaved(goal);
          const pct = goal.targetAmount > 0 ? Math.min(Math.round((saved / goal.targetAmount) * 100), 100) : 0;
          const reached = saved >= goal.targetAmount;
          const monthly = getMonthlyNeeded(goal);
          const gc = goal.color || '#34d399';

          return (
            <TouchableOpacity key={goal.id} style={st.goalCard}
              onPress={() => setShowDeposit(goal)}
              onLongPress={() => setLongPressTarget(goal)} activeOpacity={0.7}>
              <View style={st.goalTop}>
                <View style={[st.goalIcon, { backgroundColor: gc + '18' }]}>
                  <Feather name={goal.icon || 'target'} size={22} color={gc} />
                </View>
                <View style={st.goalInfo}>
                  <Text style={st.goalName}>{goal.name}</Text>
                  <Text style={st.goalMeta}>
                    {goal.targetDate ? dd : ''}{goal.targetDate && monthly ? ' · ' : ''}
                    {monthly ? `${i18n.t('monthlyNeeded')}: ${monthly.toLocaleString()} ${sym()}` : ''}
                  </Text>
                </View>
                {reached && <Feather name="check-circle" size={22} color={colors.green} />}
              </View>

              <View style={st.progressRow}>
                <Amount value={saved} style={[st.progressSaved, { color: gc }]} />
                <Amount value={goal.targetAmount} style={st.progressTarget} />
              </View>

              <View style={st.progressBar}>
                <View style={[st.progressFill, { width: `${pct}%`, backgroundColor: gc }]} />
              </View>

              <Text style={[st.progressPct, { color: gc }]}>{pct}%</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Add/Edit Modal */}
      <SwipeModal visible={showModal} onClose={() => setShowModal(false)} title={editGoal ? i18n.t('goal') : i18n.t('newGoal')}>
        <ScrollView style={st.form} showsVerticalScrollIndicator={false}>
          <Text style={st.label}>{i18n.t('goalName')}</Text>
          <TextInput style={st.input} value={name} onChangeText={setName}
            placeholder={i18n.t('goalName')} placeholderTextColor={colors.textMuted} autoFocus />

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={st.label}>{i18n.t('targetAmount')}</Text>
              <TextInput style={st.input} value={targetAmount} onChangeText={setTargetAmount}
                keyboardType="numeric" placeholder="50000" placeholderTextColor={colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.label}>{i18n.t('initialAmount')}</Text>
              <TextInput style={st.input} value={initialAmount} onChangeText={setInitialAmount}
                keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textMuted} />
            </View>
          </View>

          <Text style={st.label}>{i18n.t('targetDate')}</Text>
          <TouchableOpacity style={st.dateBtn} onPress={() => setShowDatePicker(true)}>
            <Feather name="calendar" size={16} color={colors.green} />
            <Text style={st.dateTxt}>{dd || i18n.t('selectDate')}</Text>
          </TouchableOpacity>

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
        </ScrollView>
      </SwipeModal>

      {/* Deposit Modal */}
      <SwipeModal visible={!!showDeposit} onClose={() => setShowDeposit(null)}>
        {showDeposit && (
          <View>
            <Text style={st.modalTitle}>{i18n.t('deposit')} — {showDeposit.name}</Text>
            <TextInput style={st.input} value={depositAmount} onChangeText={setDepositAmount}
              keyboardType="numeric" placeholder={i18n.t('depositAmount')} placeholderTextColor={colors.textMuted} autoFocus />
            <TextInput style={st.input} value={depositNote} onChangeText={setDepositNote}
              placeholder={i18n.t('note')} placeholderTextColor={colors.textMuted} />
            <View style={st.btnRow}>
              <TouchableOpacity style={st.cancelBtn} onPress={() => setShowDeposit(null)}>
                <Text style={st.cancelBtnText}>{i18n.t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.saveBtn, { backgroundColor: showDeposit.color || colors.green }]} onPress={handleDeposit}>
                <Feather name="plus" size={18} color={colors.bg} />
                <Text style={st.saveBtnText}>{i18n.t('deposit')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SwipeModal>

      {/* Long press menu */}
      {longPressTarget && !deleteTarget && (
        <TouchableOpacity style={st.overlay} activeOpacity={1} onPress={() => setLongPressTarget(null)}>
          <View style={st.actionSheet}>
            <Text style={st.actionTitle}>{longPressTarget.name}</Text>
            <TouchableOpacity style={st.actionBtn} onPress={() => { const g = longPressTarget; setLongPressTarget(null); openEdit(g); }}>
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

      <ConfirmModal visible={!!deleteTarget} title={i18n.t('delete')}
        message={deleteTarget?.name || ''} confirmText={i18n.t('delete')}
        cancelText={i18n.t('cancel')} onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)} icon="trash-2" />

      <DatePickerModal visible={showDatePicker} onClose={() => setShowDatePicker(false)}
        onSelect={d => setTargetDate(d)} selectedDate={targetDate} lang={lang} weekStart={weekStart} />
    </View>
  );
}

const createSt = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  addBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center' },

  empty: { alignItems: 'center', marginTop: 80, gap: 16 },
  emptyText: { color: colors.textMuted, fontSize: 16, fontWeight: '500' },

  goalCard: { marginHorizontal: 20, marginBottom: 12, backgroundColor: colors.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.cardBorder },
  goalTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  goalIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  goalInfo: { flex: 1 },
  goalName: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 4 },
  goalMeta: { color: colors.textDim, fontSize: 12, fontWeight: '500' },

  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressSaved: { fontSize: 18, fontWeight: '700' },
  progressTarget: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  progressBar: { height: 10, backgroundColor: colors.bg2, borderRadius: 5, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: 10, borderRadius: 5 },
  progressPct: { fontSize: 13, fontWeight: '700', textAlign: 'right' },

  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 16, paddingHorizontal: 24 },
  form: { paddingHorizontal: 24, paddingBottom: 30 },
  label: { color: colors.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  input: { color: colors.text, fontSize: 16, backgroundColor: colors.bg2, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: colors.cardBorder },
  dateBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg2, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: colors.cardBorder, gap: 8 },
  dateTxt: { color: colors.textDim, fontSize: 14, fontWeight: '600' },

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
