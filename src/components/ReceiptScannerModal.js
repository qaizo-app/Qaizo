// src/components/ReceiptScannerModal.js
// Scan receipt with camera or gallery → Gemini Vision → create transaction
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import aiService from '../services/aiService';
import dataService from '../services/dataService';
import { categoryConfig, colors } from '../theme/colors';
import { sym } from '../utils/currency';
import DatePickerModal from './DatePickerModal';
import SwipeModal from './SwipeModal';

export default function ReceiptScannerModal({ visible, onClose, onSaved }) {
  const [step, setStep] = useState('pick'); // pick, scanning, result, saving
  const [images, setImages] = useState([]); // [{uri, base64}]
  const [result, setResult] = useState(null);
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('other');
  const [recipient, setRecipient] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selAcc, setSelAcc] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState('');
  const st = createSt();

  // Load accounts when modal opens
  useEffect(() => {
    if (visible) {
      dataService.getAccounts().then(accs => {
        setAccounts(accs);
        if (accs.length > 0) setSelAcc(accs[0].id);
      });
    }
  }, [visible]);

  const reset = () => {
    setStep('pick');
    setImages([]);
    setResult(null);
    setAmount('');
    setCategoryId('other');
    setRecipient('');
    setDateStr('');
    setShowDatePicker(false);
    setSelAcc(accounts.length > 0 ? accounts[0].id : '');
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const pickImage = async (useCamera) => {
    try {
      const options = { base64: true, quality: 0.4, allowsEditing: false, exif: false };
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
      if (!asset.base64) {
        setError(i18n.t('scanFailed'));
        return;
      }

      const newImages = [...images, { uri: asset.uri, base64: asset.base64 }];
      setImages(newImages);
      setError('');
    } catch (e) {
      if (__DEV__) console.error('Image pick error:', e);
      setError(i18n.t('scanFailed'));
    }
  };

  const scanImages = async () => {
    if (images.length === 0) return;
    setStep('scanning');
    setError('');

    try {
      const base64List = images.map(img => img.base64);
      if (__DEV__) console.log('Scanning', images.length, 'images');

      // Two parallel requests: 1) summary  2) items
      const [scanResult, itemsResult] = await Promise.all([
        aiService.scanReceipt(base64List, i18n.getLanguage()),
        aiService.scanReceiptItems(base64List),
      ]);

      if (scanResult && (scanResult.total || scanResult.store)) {
        if (itemsResult?.length) scanResult.items = itemsResult;
        setResult(scanResult);
        setAmount(String(scanResult.total));
        setCategoryId(scanResult.category || 'other');
        setRecipient(scanResult.store || '');
        setDateStr(scanResult.date || new Date().toISOString().slice(0, 10));
        setStep('result');
      } else {
        setError(i18n.t('scanFailed'));
        setStep('pick');
      }
    } catch (e) {
      if (__DEV__) console.error('Receipt scan error:', e);
      setError(i18n.t('scanFailed'));
      setStep('pick');
    }
  };

  const handleSave = async () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) return;

    // Check for duplicate — same amount + same date
    const txs = await dataService.getTransactions();
    const txDate = dateStr || new Date().toISOString().slice(0, 10);
    const duplicate = txs.find(t =>
      t.type === 'expense' &&
      Math.abs(t.amount - num) < 0.01 &&
      (t.date || t.createdAt || '').slice(0, 10) === txDate
    );
    if (duplicate) {
      const dupName = duplicate.recipient || duplicate.categoryName || i18n.t(duplicate.categoryId);
      setError(i18n.t('duplicateReceipt') + ` (${dupName} — ${duplicate.amount})`);
      return;
    }

    setStep('saving');

    await dataService.addTransaction({
      type: 'expense',
      amount: num,
      categoryId,
      icon: (categoryConfig[categoryId] || categoryConfig.other).icon,
      recipient,
      note: result?.items?.length ? result.items.map(i => `${i.name}: ${i.price}`).join(', ') : '',
      receiptItems: result?.items || [],
      currency: sym(),
      date: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
      account: selAcc || null,
      tags: [],
    });

    onSaved?.();
    handleClose();
  };

  return (
    <>
    <SwipeModal visible={visible} onClose={handleClose}>
      {({ close }) => (
        <View style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={st.title}>{i18n.t('scanReceipt')}</Text>

          {/* Duplicate warning */}
          {error ? (
            <View style={st.errorCard}>
              <Feather name="alert-circle" size={18} color={colors.red} />
              <Text style={st.errorCardText}>{error}</Text>
            </View>
          ) : null}

          {/* Step: Pick image(s) */}
          {step === 'pick' && (
            <View>
              {/* Thumbnails of added images */}
              {images.length > 0 && (
                <View style={st.thumbRow}>
                  {images.map((img, idx) => (
                    <View key={idx} style={st.thumbWrap}>
                      <Image source={{ uri: img.uri }} style={st.thumb} resizeMode="cover" />
                      <TouchableOpacity style={st.thumbRemove} onPress={() => setImages(images.filter((_, i) => i !== idx))}>
                        <Feather name="x" size={12} color={colors.bg} />
                      </TouchableOpacity>
                      <Text style={st.thumbNum}>{idx + 1}</Text>
                    </View>
                  ))}
                </View>
              )}

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

              {images.length > 0 && (
                <TouchableOpacity style={st.scanBtn} onPress={scanImages}>
                  <Feather name="search" size={18} color={colors.bg} />
                  <Text style={st.scanBtnText}>{i18n.t('scanningReceipt').replace('...', '')} ({images.length})</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Step: Scanning */}
          {step === 'scanning' && (
            <View style={st.scanningWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {images.map((img, idx) => (
                  <Image key={idx} source={{ uri: img.uri }} style={st.resultThumb} resizeMode="cover" />
                ))}
              </ScrollView>
              <ActivityIndicator size="large" color={colors.green} style={{ marginTop: 16 }} />
              <Text style={st.scanningText}>{i18n.t('scanningReceipt')}</Text>
            </View>
          )}

          {/* Step: Result */}
          {step === 'result' && (
            <View>
              {images.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {images.map((img, idx) => (
                    <Image key={idx} source={{ uri: img.uri }} style={st.resultThumb} resizeMode="cover" />
                  ))}
                </ScrollView>
              )}

              {/* Amount */}
              <Text style={st.label}>{i18n.t('amount')}</Text>
              <View style={st.amountRow}>
                <Text style={st.currency}>{sym()}</Text>
                <TextInput style={st.amountInput} value={amount} onChangeText={setAmount}
                  keyboardType="decimal-pad" />
              </View>

              {/* Store + Date row */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={st.label}>{i18n.t('payee')}</Text>
                  <TextInput style={st.input} value={recipient} onChangeText={setRecipient} />
                </View>
                <View>
                  <Text style={st.label}>{i18n.t('date')}</Text>
                  <TouchableOpacity style={st.dateBtn} onPress={() => setShowDatePicker(true)}>
                    <Feather name="calendar" size={14} color={colors.green} />
                    <Text style={st.dateBtnText}>
                      {dateStr ? dateStr.split('-').reverse().join('.') : i18n.t('date')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Account */}
              <Text style={st.label}>{i18n.t('account')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {accounts.filter(a => ['cash', 'bank', 'credit'].includes(a.type)).map(acc => {
                  const sel = selAcc === acc.id;
                  return (
                    <TouchableOpacity key={acc.id} style={[st.catChip, sel && { borderColor: colors.green, backgroundColor: colors.greenSoft }]}
                      onPress={() => setSelAcc(acc.id)}>
                      <Feather name="credit-card" size={14} color={sel ? colors.green : colors.textMuted} />
                      <Text style={[st.catText, sel && { color: colors.green }]} numberOfLines={1}>{acc.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

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

            </View>
          )}

          {/* Step: Saving */}
          {step === 'saving' && (
            <View style={st.scanningWrap}>
              <ActivityIndicator size="large" color={colors.green} />
            </View>
          )}
        </ScrollView>

        {/* Buttons — fixed at bottom */}
        {step === 'result' && (
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
        )}
        </View>
      )}
    </SwipeModal>
    <DatePickerModal visible={showDatePicker} onClose={() => setShowDatePicker(false)}
      onSelect={d => setDateStr(d)} selectedDate={dateStr} lang={i18n.getLanguage()} />
  </>
  );
}

const createSt = () => StyleSheet.create({
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 20, textAlign: i18n.textAlign() },

  pickRow: { flexDirection: i18n.row(), gap: 16, marginBottom: 16 },
  pickBtn: { flex: 1, alignItems: 'center', paddingVertical: 24, borderRadius: 16, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.cardBorder },
  pickIcon: { width: 60, height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  pickText: { color: colors.text, fontSize: 14, fontWeight: '600' },

  thumbRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  thumbWrap: { position: 'relative' },
  thumb: { width: 70, height: 90, borderRadius: 10, backgroundColor: colors.bg2 },
  thumbRemove: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.red, justifyContent: 'center', alignItems: 'center' },
  thumbNum: { position: 'absolute', bottom: 4, left: 4, color: colors.bg, fontSize: 10, fontWeight: '800', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 4, borderRadius: 4 },
  scanBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.green, borderRadius: 14, paddingVertical: 16, marginTop: 8 },
  scanBtnText: { color: colors.bg, fontSize: 16, fontWeight: '700' },
  resultThumb: { width: 80, height: 100, borderRadius: 10, marginEnd: 8, backgroundColor: colors.bg2 },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bg2, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.cardBorder },
  dateBtnText: { color: colors.textDim, fontSize: 14, fontWeight: '600' },
  scanningWrap: { alignItems: 'center', paddingVertical: 24 },
  scanningText: { color: colors.textDim, fontSize: 14, marginTop: 12 },

  label: { color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6, textAlign: i18n.textAlign() },
  amountRow: { flexDirection: i18n.row(), alignItems: 'center', backgroundColor: colors.bg2, borderRadius: 14, paddingHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.cardBorder },
  currency: { color: colors.green, fontSize: 24, fontWeight: '700', marginEnd: 8 },
  amountInput: { flex: 1, color: colors.text, fontSize: 24, fontWeight: '700', paddingVertical: 14 },
  input: { backgroundColor: colors.bg2, borderRadius: 14, padding: 14, color: colors.text, fontSize: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.cardBorder, textAlign: i18n.textAlign() },

  catChip: { flexDirection: i18n.row(), alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.bg2, marginEnd: 6, borderWidth: 1.5, borderColor: 'transparent', gap: 4 },
  catText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },

  itemsCard: { backgroundColor: colors.bg2, borderRadius: 14, padding: 12, marginBottom: 16 },
  itemsTitle: { color: colors.textDim, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  itemRow: { flexDirection: i18n.row(), justifyContent: 'space-between', paddingVertical: 6 },
  itemName: { color: colors.text, fontSize: 12, flex: 1 },
  itemPrice: { color: colors.textDim, fontSize: 12, fontWeight: '600' },

  btnRow: { flexDirection: i18n.row(), gap: 12, paddingVertical: 12 },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: colors.bg2, alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  cancelText: { color: colors.textDim, fontSize: 16, fontWeight: '600' },
  saveBtn: { flex: 2, flexDirection: i18n.row(), paddingVertical: 16, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', gap: 6 },
  saveText: { color: colors.bg, fontSize: 16, fontWeight: '700' },

  errorCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.redSoft, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.red + '30' },
  errorCardText: { color: colors.red, fontSize: 12, fontWeight: '600', flex: 1 },
  error: { color: colors.red, fontSize: 12, textAlign: 'center', marginTop: 8 },
});
