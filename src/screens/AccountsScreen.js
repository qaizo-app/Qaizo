// src/screens/AccountsScreen.js
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Card from '../components/Card';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { colors } from '../theme/colors';
 
const ACCOUNT_ICONS = ['🏦', '💳', '💵', '💶', '💷', '🏠', '📊', '💰', '🪙', '🏛️'];
const ACCOUNT_TYPES = ['bank', 'credit', 'cash'];
 
export default function AccountsScreen() {
  const [accounts, setAccounts] = useState([]);
  const [showEdit, setShowEdit] = useState(false);
  const [editAccount, setEditAccount] = useState(null);
  const [editName, setEditName] = useState('');
  const [editBalance, setEditBalance] = useState('');
  const [editIcon, setEditIcon] = useState('🏦');
  const [editType, setEditType] = useState('bank');
  const [, forceUpdate] = useState(0);
 
  const loadData = async () => {
    const accs = await dataService.getAccounts();
    setAccounts(accs);
    forceUpdate(n => n + 1);
  };
 
  useFocusEffect(useCallback(() => { loadData(); }, []));
 
  const grouped = {
    bank: accounts.filter(a => a.type === 'bank'),
    credit: accounts.filter(a => a.type === 'credit'),
    cash: accounts.filter(a => a.type === 'cash'),
  };
 
  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
 
  const openEdit = (acc) => {
    setEditAccount(acc);
    setEditName(acc.name);
    setEditBalance(String(acc.balance || 0));
    setEditIcon(acc.icon || '🏦');
    setEditType(acc.type || 'bank');
    setShowEdit(true);
  };
 
  const openAdd = () => {
    setEditAccount(null);
    setEditName('');
    setEditBalance('0');
    setEditIcon('🏦');
    setEditType('bank');
    setShowEdit(true);
  };
 
  const handleSave = async () => {
    if (!editName.trim()) return;
    const balance = parseFloat(editBalance) || 0;
 
    if (editAccount) {
      await dataService.updateAccount(editAccount.id, {
        name: editName.trim(),
        balance,
        icon: editIcon,
        type: editType,
      });
    } else {
      await dataService.addAccount({
        name: editName.trim(),
        balance,
        icon: editIcon,
        type: editType,
        currency: '₪',
      });
    }
    setShowEdit(false);
    await loadData();
  };
 
  const handleDelete = () => {
    if (!editAccount) return;
    Alert.alert(i18n.t('delete'), editAccount.name + '?', [
      { text: i18n.t('cancel'), style: 'cancel' },
      { text: i18n.t('delete'), style: 'destructive', onPress: async () => {
        await dataService.deleteAccount(editAccount.id);
        setShowEdit(false);
        await loadData();
      }},
    ]);
  };
 
  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.header}>
          <Text style={styles.title}>{i18n.t('accounts')}</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>
 
        <Card highlighted>
          <Text style={styles.totalLabel}>{i18n.t('totalAssets')}</Text>
          <Text style={[styles.totalAmount, { color: totalBalance >= 0 ? colors.text : colors.red }]}>
            ₪ {totalBalance.toLocaleString()}
          </Text>
        </Card>
 
        {Object.entries(grouped).map(([type, accs]) => (
          accs.length > 0 && (
            <View key={type}>
              <Text style={styles.groupTitle}>{i18n.t(type)}</Text>
              {accs.map(acc => (
                <Card key={acc.id}>
                  <TouchableOpacity style={styles.accRow} onPress={() => openEdit(acc)} activeOpacity={0.7}>
                    <Text style={styles.accIcon}>{acc.icon}</Text>
                    <View style={styles.accInfo}>
                      <Text style={styles.accName}>{acc.name}</Text>
                      <Text style={styles.accType}>{i18n.t(acc.type)}</Text>
                    </View>
                    <Text style={[styles.accBalance, { color: (acc.balance || 0) >= 0 ? colors.text : colors.red }]}>
                      {acc.currency || '₪'} {(acc.balance || 0).toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                </Card>
              ))}
            </View>
          )
        ))}
      </ScrollView>
 
      {/* Edit/Add Modal */}
      <Modal visible={showEdit} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.handle} />
            <Text style={styles.modalTitle}>
              {editAccount ? editAccount.name : i18n.t('addAccount')}
            </Text>
 
            {/* Icon selector */}
            <View style={styles.iconRow}>
              {ACCOUNT_ICONS.map(icon => (
                <TouchableOpacity
                  key={icon}
                  style={[styles.iconBtn, editIcon === icon && styles.iconBtnActive]}
                  onPress={() => setEditIcon(icon)}
                >
                  <Text style={styles.iconBtnText}>{icon}</Text>
                </TouchableOpacity>
              ))}
            </View>
 
            {/* Type selector */}
            <View style={styles.typeRow}>
              {ACCOUNT_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, editType === t && styles.typeBtnActive]}
                  onPress={() => setEditType(t)}
                >
                  <Text style={[styles.typeBtnText, editType === t && styles.typeBtnTextActive]}>
                    {i18n.t(t)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
 
            {/* Name */}
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder={i18n.t('account')}
              placeholderTextColor={colors.textMuted}
            />
 
            {/* Balance */}
            <View style={styles.balanceRow}>
              <Text style={styles.balanceCurrency}>₪</Text>
              <TextInput
                style={styles.balanceInput}
                value={editBalance}
                onChangeText={setEditBalance}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
              />
            </View>
 
            {/* Buttons */}
            <View style={styles.buttonRow}>
              {editAccount && (
                <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                  <Text style={styles.deleteBtnText}>🗑️</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEdit(false)}>
                <Text style={styles.cancelBtnText}>{i18n.t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>{i18n.t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
 
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 60, paddingBottom: 16,
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  addBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: colors.green,
    justifyContent: 'center', alignItems: 'center',
  },
  addBtnText: { color: colors.bg, fontSize: 22, fontWeight: '700' },
  totalLabel: { color: colors.textDim, fontSize: 13, marginBottom: 8 },
  totalAmount: { fontSize: 32, fontWeight: '800' },
  groupTitle: {
    color: colors.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
    textTransform: 'uppercase', paddingHorizontal: 24, marginTop: 24, marginBottom: 8,
  },
  accRow: { flexDirection: 'row', alignItems: 'center' },
  accIcon: { fontSize: 28, marginRight: 14 },
  accInfo: { flex: 1 },
  accName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  accType: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  accBalance: { fontSize: 17, fontWeight: '700' },
 
  // Modal
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.textMuted, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 20 },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: colors.card,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'transparent',
  },
  iconBtnActive: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  iconBtnText: { fontSize: 22 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.card,
    alignItems: 'center', borderWidth: 1, borderColor: 'transparent',
  },
  typeBtnActive: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  typeBtnText: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  typeBtnTextActive: { color: colors.green },
  input: {
    backgroundColor: colors.card, borderRadius: 12, padding: 14,
    color: colors.text, fontSize: 16, marginBottom: 12,
    borderWidth: 1, borderColor: colors.cardBorder,
  },
  balanceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  balanceCurrency: { color: colors.green, fontSize: 28, fontWeight: '700', marginRight: 8 },
  balanceInput: { flex: 1, color: colors.text, fontSize: 28, fontWeight: '700' },
  buttonRow: { flexDirection: 'row', gap: 10 },
  deleteBtn: {
    width: 52, paddingVertical: 16, borderRadius: 12, backgroundColor: colors.redSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 20 },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 12, backgroundColor: colors.card, alignItems: 'center' },
  cancelBtnText: { color: colors.textDim, fontSize: 16, fontWeight: '600' },
  saveBtn: { flex: 2, paddingVertical: 16, borderRadius: 12, backgroundColor: colors.green, alignItems: 'center' },
  saveBtnText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
});