// src/components/ReceiptScannerModal.js
// Scan receipt with camera or gallery → Gemini Vision → create transaction
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import aiService from '../services/aiService';
import dataService from '../services/dataService';
import { categoryConfig, colors } from '../theme/colors';
import { sym } from '../utils/currency';
import SwipeModal from './SwipeModal';

export default function ReceiptScannerModal({ visible, onClose, onSaved }) {
  const [step, setStep] = useState('pick'); // pick, scanning, result, saving
  const [imageUri, setImageUri] = useState(null);
  const [result, setResult] = useState(null);
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('other');
  const [recipient, setRecipient] = useState('');
  const [error, setError] = useState('');
  const st = createSt();

  const reset = () => {
    setStep('pick');
    setImageUri(null);
    setResult(null);
    setAmount('');
    setCategoryId('other');
    setRecipient('');
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const pickImage = async (useCamera) => {
    try {
      const options = { base64: true, quality: 0.6, allowsEditing: false };
      let res;
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { setError(i18n.t('cameraPermission')); return; }
        res = await ImagePicker.launchCameraAsync(options);
      } else {
        res = await ImagePicker.launchImageLibraryAsync(options);
      }
      if (res.canceled || !res.assets?.[0]) return;

      const asset = res.assets[0];
      setImageUri(asset.uri);
      setStep('scanning');
      setError('');

      const scanResult = await aiService.scanReceipt(asset.base64, i18n.getLanguage());
      if (scanResult && scanResult.total) {
        setResult(scanResult);
        setAmount(String(scanResult.total));
        setCategoryId(scanResult.category || 'other');
        setRecipient(scanResult.store || '');
        setStep('result');
      } else {
        setError(i18n.t('scanFailed'));
        setStep('pick');
      }
    } catch (e) {
      console.error('Receipt scan error:', e);
      setError(i18n.t('scanFailed'));
      setStep('pick');
    }
  };

  const handleSave = async () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) return;
    setStep('saving');

    await dataService.addTransaction({
      type: 'expense',
      amount: num,
      categoryId,
      icon: (categoryConfig[categoryId] || categoryConfig.other).icon,
      recipient,
      note: result?.items ? result.items.map(i => `${i.name}: ${i.price}`).join(', ') : '',
      currency: sym(),
      date: result?.date ? new Date(result.date).toISOString() : new Date().toISOString(),
      account: null,
      tags: [],
    });

    onSaved?.();
    handleClose();
  };

  return (
    <SwipeModal visible={visible} onClose={handleClose}>
      {({ close }) => (
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={st.title}>{i18n.t('scanReceipt')}</Text>

          {/* Step: Pick image */}
          {step === 'pick' && (
            <View>
              <View style={st.pickRow}>
                <TouchableOpacity style={st.pickBtn} onPress={() => pickImage(true)}>
                  <View style={[st.pickIcon, { backgroundColor: colors.greenSoft }]}>
                    <Feather name="camera" size={28} color={colors.green} />
                  </View>
                  <Text style={st.pickText}>{i18n.t('takePhoto')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.pickBtn} onPress={() => pickImage(false)}>
                  <View style={[st.pickIcon, { backgroundColor: colors.blueSoft }]}>
                    <Feather name="image" size={28} color={colors.blue} />
                  </View>
                  <Text style={st.pickText}>{i18n.t('fromGallery')}</Text>
                </TouchableOpacity>
              </View>
              {error ? <Text style={st.error}>{error}</Text> : null}
            </View>
          )}

          {/* Step: Scanning */}
          {step === 'scanning' && (
            <View style={st.scanningWrap}>
              {imageUri && <Image source={{ uri: imageUri }} style={st.preview} resizeMode="contain" />}
              <ActivityIndicator size="large" color={colors.green} style={{ marginTop: 16 }} />
              <Text style={st.scanningText}>{i18n.t('scanningReceipt')}</Text>
            </View>
          )}

          {/* Step: Result */}
          {step === 'result' && (
            <View>
              {imageUri && <Image source={{ uri: imageUri }} style={st.previewSmall} resizeMode="contain" />}

              {/* Amount */}
              <Text style={st.label}>{i18n.t('amount')}</Text>
              <View style={st.amountRow}>
                <Text style={st.currency}>{sym()}</Text>
                <TextInput style={st.amountInput} value={amount} onChangeText={setAmount}
                  keyboardType="decimal-pad" />
              </View>

              {/* Store */}
              <Text style={st.label}>{i18n.t('payee')}</Text>
              <TextInput style={st.input} value={recipient} onChangeText={setRecipient} />

              {/* Category */}
              <Text style={st.label}>{i18n.t('category')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {Object.keys(categoryConfig).filter(k => !['transfer', 'salary_me', 'salary_spouse', 'rental_income', 'handyman', 'sales', 'other_income'].includes(k)).map(cid => {
                  const cfg = categoryConfig[cid];
                  const sel = categoryId === cid;
                  return (
                    <TouchableOpacity key={cid} style={[st.catChip, sel && { borderColor: cfg.color, backgroundColor: `${cfg.color}15` }]}
                      onPress={() => setCategoryId(cid)}>
                      <Feather name={cfg.icon} size={14} color={sel ? cfg.color : colors.textMuted} />
                      <Text style={[st.catText, sel && { color: cfg.color }]} numberOfLines={1}>{i18n.t(cid)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Items */}
              {result?.items?.length > 0 && (
                <View style={st.itemsCard}>
                  <Text style={st.itemsTitle}>{i18n.t('items')}</Text>
                  {result.items.map((item, idx) => (
                    <View key={idx} style={st.itemRow}>
                      <Text style={st.itemName} numberOfLines={1}>{item.name}</Text>
                      <Text style={st.itemPrice}>{item.price} {sym()}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Buttons */}
              <View style={st.btnRow}>
                <TouchableOpacity style={st.cancelBtn} onPress={reset}>
                  <Text style={st.cancelText}>{i18n.t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.saveBtn, { opacity: amount && parseFloat(amount) > 0 ? 1 : 0.35 }]}
                  onPress={handleSave} disabled={!amount || parseFloat(amount) <= 0}>
                  <Feather name="check" size={18} color={colors.bg} />
                  <Text style={st.saveText}>{i18n.t('save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step: Saving */}
          {step === 'saving' && (
            <View style={st.scanningWrap}>
              <ActivityIndicator size="large" color={colors.green} />
            </View>
          )}
        </ScrollView>
      )}
    </SwipeModal>
  );
}

const createSt = () => StyleSheet.create({
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 20, textAlign: i18n.textAlign() },

  pickRow: { flexDirection: i18n.row(), gap: 16, marginBottom: 16 },
  pickBtn: { flex: 1, alignItems: 'center', paddingVertical: 24, borderRadius: 16, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.cardBorder },
  pickIcon: { width: 60, height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  pickText: { color: colors.text, fontSize: 14, fontWeight: '600' },

  scanningWrap: { alignItems: 'center', paddingVertical: 24 },
  preview: { width: '100%', height: 250, borderRadius: 14 },
  previewSmall: { width: '100%', height: 150, borderRadius: 14, marginBottom: 16 },
  scanningText: { color: colors.textDim, fontSize: 14, marginTop: 12 },

  label: { color: colors.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6, textAlign: i18n.textAlign() },
  amountRow: { flexDirection: i18n.row(), alignItems: 'center', backgroundColor: colors.bg2, borderRadius: 14, paddingHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.cardBorder },
  currency: { color: colors.green, fontSize: 24, fontWeight: '700', marginEnd: 8 },
  amountInput: { flex: 1, color: colors.text, fontSize: 24, fontWeight: '700', paddingVertical: 14 },
  input: { backgroundColor: colors.bg2, borderRadius: 14, padding: 14, color: colors.text, fontSize: 15, marginBottom: 12, borderWidth: 1, borderColor: colors.cardBorder, textAlign: i18n.textAlign() },

  catChip: { flexDirection: i18n.row(), alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.bg2, marginEnd: 6, borderWidth: 1.5, borderColor: 'transparent', gap: 4 },
  catText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },

  itemsCard: { backgroundColor: colors.bg2, borderRadius: 14, padding: 12, marginBottom: 16 },
  itemsTitle: { color: colors.textDim, fontSize: 11, fontWeight: '700', marginBottom: 8 },
  itemRow: { flexDirection: i18n.row(), justifyContent: 'space-between', paddingVertical: 6 },
  itemName: { color: colors.text, fontSize: 13, flex: 1 },
  itemPrice: { color: colors.textDim, fontSize: 13, fontWeight: '600' },

  btnRow: { flexDirection: i18n.row(), gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: colors.bg2, alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  cancelText: { color: colors.textDim, fontSize: 16, fontWeight: '600' },
  saveBtn: { flex: 2, flexDirection: i18n.row(), paddingVertical: 16, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', gap: 6 },
  saveText: { color: colors.bg, fontSize: 16, fontWeight: '700' },

  error: { color: colors.red, fontSize: 13, textAlign: 'center', marginTop: 8 },
});
