// src/components/ReceiptScannerModal.js
// Scan receipt with camera or gallery → Gemini Vision → create transaction
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import aiService from '../services/aiService';
import analyticsEvents from '../services/analyticsEvents';
import dataService from '../services/dataService';
import { categoryConfig, colors } from '../theme/colors';
import { catName } from '../utils/categoryName';
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
  const [splitByCategory, setSplitByCategory] = useState(true);
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
    setSplitByCategory(true);
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const pickImage = async (useCamera) => {
    try {
      const options = { base64: true, quality: 0.85, allowsEditing: true, exif: false };
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

        // Auto-pick the best matching account based on payment method detected
        try {
          const active = accounts.filter(a => a.isActive !== false);
          let pickedId = null;
          // 1. Brand-specific: e.g. "Visa Power" if AI saw a Visa card
          if (scanResult.cardBrand && aiService.CARD_BRAND_KEYWORDS) {
            const brandKws = aiService.CARD_BRAND_KEYWORDS[scanResult.cardBrand] || [];
            const brandMatches = active.filter(a => brandKws.some(kw => (a.name || '').toLowerCase().includes(kw)));
            if (brandMatches.length === 1) {
              pickedId = brandMatches[0].id;
            } else if (brandMatches.length > 1) {
              const last4 = scanResult.last4;
              if (last4) {
                const byLast4 = brandMatches.find(a => (a.name || '').includes(last4));
                if (byLast4) pickedId = byLast4.id;
              }
              if (!pickedId) {
                pickedId = await dataService.getLastUsedAccountByType('credit');
                if (!brandMatches.find(a => a.id === pickedId)) pickedId = brandMatches[0].id;
              }
            }
          }
          // 2. Type-based: cash / credit / bank
          if (!pickedId && scanResult.accountType) {
            const typeMatches = active.filter(a => a.type === scanResult.accountType);
            if (typeMatches.length === 1) pickedId = typeMatches[0].id;
            else if (typeMatches.length > 1) pickedId = await dataService.getLastUsedAccountByType(scanResult.accountType);
          }
          if (pickedId) setSelAcc(pickedId);
        } catch (e) { /* keep default selection */ }

        setStep('result');
        analyticsEvents.logEvent('receipt_scanned', {
          success: true,
          images: images.length,
          items_extracted: itemsResult?.length || 0,
        });
      } else {
        const aiErr = aiService.getLastAIError?.();
        // Friendly message when the build was shipped without an AI key —
        // otherwise the user keeps re-photographing receipts thinking the
        // photo is bad. Other codes keep the raw diagnostic tail.
        if (aiErr?.code === 'no_api_key') {
          setError(i18n.t('aiNotConfigured'));
        } else {
          const detail = aiErr ? ` [${aiErr.code}${aiErr.status ? ' ' + aiErr.status : ''}${aiErr.message ? ': ' + aiErr.message : ''}]` : '';
          setError(i18n.t('scanFailed') + detail);
        }
        setStep('pick');
        analyticsEvents.logEvent('receipt_scanned', { success: false, images: images.length, reason: aiErr?.code });
      }
    } catch (e) {
      if (__DEV__) console.error('Receipt scan error:', e);
      setError(i18n.t('scanFailed') + ` [${String(e?.message || e)}]`);
      setStep('pick');
      analyticsEvents.logEvent('receipt_scanned', { success: false, error: true });
    }
  };

  const handleSave = async () => {
    const num = parseFloat(amount.replace(',', '.'));
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
      const dupName = duplicate.recipient || catName(duplicate.categoryId, duplicate.categoryName);
      setError(i18n.t('duplicateReceipt') + ` (${dupName} — ${duplicate.amount})`);
      return;
    }

    setStep('saving');

    // Determine if we should split by category. Required: split toggle on,
    // items present with category info, AND multiple distinct categories.
    const itemsByCat = {};
    if (result?.items?.length) {
      result.items.forEach(it => {
        const c = it.category || 'other';
        itemsByCat[c] = (itemsByCat[c] || 0) + (Number(it.price) || 0);
      });
    }
    const distinctCats = Object.keys(itemsByCat);
    const willSplit = splitByCategory && distinctCats.length > 1;

    if (willSplit) {
      // Scale per-category sums to match the user-confirmed total (handles
      // the case where AI's items sum != receipt total — e.g. discounts/tax).
      const itemsSum = distinctCats.reduce((s, c) => s + itemsByCat[c], 0);
      const scale = itemsSum > 0 ? num / itemsSum : 1;
      const scaled = distinctCats.map(c => ({ categoryId: c, amount: Math.round(itemsByCat[c] * scale * 100) / 100 }));
      // Adjust last row to absorb rounding so the splits sum to exact total
      const sumScaled = scaled.reduce((s, r) => s + r.amount, 0);
      if (scaled.length > 0) scaled[scaled.length - 1].amount = Math.round((scaled[scaled.length - 1].amount + (num - sumScaled)) * 100) / 100;

      // Save one transaction per category. They share recipient, account, date,
      // and a transferPairId-style group marker so they can be visually grouped
      // in transaction list later.
      const groupId = Date.now().toString();
      for (const row of scaled) {
        if (row.amount <= 0) continue;
        const itemsInCat = (result?.items || []).filter(it => (it.category || 'other') === row.categoryId);
        await dataService.addTransaction({
          type: 'expense',
          amount: row.amount,
          categoryId: row.categoryId,
          icon: (categoryConfig[row.categoryId] || categoryConfig.other).icon,
          recipient,
          note: itemsInCat.length ? itemsInCat.map(i => `${i.name}: ${i.price}`).join(', ') : '',
          receiptItems: itemsInCat,
          receiptGroupId: groupId,
          currency: sym(),
          date: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
          account: selAcc || null,
          tags: [],
        });
      }
    } else {
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
    }

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
                  <Text style={st.scanBtnText}>{i18n.t('scanReceiptAction')} ({images.length})</Text>
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
                <Text style={[st.currency, { fontSize: amtFont(amount, 24) }]}>{sym()}</Text>
                <TextInput style={[st.amountInput, { fontSize: amtFont(amount, 24) }]} value={amount} onChangeText={setAmount}
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
              {(result?.accountType || result?.cardBrand) && (
                <View style={st.detectedRow}>
                  <Feather name="zap" size={11} color={colors.green} />
                  <Text style={st.detectedTxt}>
                    {result.cardBrand ? `${result.cardBrand.toUpperCase()}${result.last4 ? ` **** ${result.last4}` : ''}` : (result.accountType || '').toUpperCase()}
                  </Text>
                </View>
              )}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {(() => {
                  const payable = accounts.filter(a => ['cash', 'bank', 'credit'].includes(a.type));
                  let choices = payable;
                  if (result?.cardBrand && aiService.CARD_BRAND_KEYWORDS) {
                    const brandKws = aiService.CARD_BRAND_KEYWORDS[result.cardBrand] || [];
                    const brandMatches = payable.filter(a => brandKws.some(kw => (a.name || '').toLowerCase().includes(kw)));
                    if (brandMatches.length > 0) choices = brandMatches;
                  } else if (result?.accountType) {
                    const typeMatches = payable.filter(a => a.type === result.accountType);
                    if (typeMatches.length > 0) choices = typeMatches;
                  }
                  return choices.map(acc => {
                    const sel = selAcc === acc.id;
                    return (
                      <TouchableOpacity key={acc.id} style={[st.catChip, sel && { borderColor: colors.green, backgroundColor: colors.greenSoft }]}
                        onPress={() => setSelAcc(acc.id)}>
                        <Feather name="credit-card" size={14} color={sel ? colors.green : colors.textMuted} />
                        <Text style={[st.catText, sel && { color: colors.green }]} numberOfLines={1}>{acc.name}</Text>
                      </TouchableOpacity>
                    );
                  });
                })()}
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

              {/* Items + per-category breakdown + split toggle */}
              {result?.items?.length > 0 && (() => {
                const itemsSum = result.items.reduce((s, it) => s + (Number(it.price) || 0), 0);
                const totalNum = Number(result.total) || 0;
                const diff = totalNum > 0 ? Math.abs(itemsSum - totalNum) : 0;
                const diffPct = totalNum > 0 ? (diff / totalNum) * 100 : 0;
                const significantMismatch = totalNum > 0 && diffPct > 5;
                // Build per-category breakdown
                const catTotals = {};
                result.items.forEach(it => {
                  const c = it.category || 'other';
                  catTotals[c] = (catTotals[c] || 0) + (Number(it.price) || 0);
                });
                const catEntries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
                const hasMultipleCategories = catEntries.length > 1;
                return (
                  <View style={st.itemsCard}>
                    <View style={st.itemsHeader}>
                      <Text style={st.itemsTitle}>{i18n.t('items')} ({result.items.length})</Text>
                      <Text style={[st.itemsSum, significantMismatch && { color: colors.red }]}>
                        {Math.round(itemsSum * 100) / 100} {sym()}
                      </Text>
                    </View>
                    {significantMismatch && (
                      <View style={st.mismatchRow}>
                        <Feather name="alert-circle" size={12} color={colors.red} />
                        <Text style={st.mismatchTxt}>
                          {(i18n.t('itemsTotalMismatch') || 'Items sum differs from total by {pct}%').replace('{pct}', Math.round(diffPct))}
                        </Text>
                      </View>
                    )}
                    {hasMultipleCategories && (
                      <View style={st.breakdownRow}>
                        {catEntries.map(([cat, amt]) => {
                          const cfg = categoryConfig[cat] || categoryConfig.other;
                          return (
                            <View key={cat} style={[st.breakdownChip, { backgroundColor: cfg.color + '20' }]}>
                              <Feather name={cfg.icon} size={10} color={cfg.color} />
                              <Text style={[st.breakdownTxt, { color: cfg.color }]}>{i18n.t(cat)}: {Math.round(amt)}</Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                    {hasMultipleCategories && (
                      <TouchableOpacity style={[st.splitToggle, splitByCategory && st.splitToggleActive]}
                        activeOpacity={0.7} onPress={() => setSplitByCategory(!splitByCategory)}>
                        <Feather name={splitByCategory ? 'check-square' : 'square'} size={14} color={splitByCategory ? colors.green : colors.textMuted} />
                        <Text style={[st.splitToggleTxt, splitByCategory && { color: colors.green }]}>{i18n.t('splitByCategory')}</Text>
                      </TouchableOpacity>
                    )}
                    {result.items.map((item, idx) => {
                      const cfg = categoryConfig[item.category] || categoryConfig.other;
                      return (
                        <View key={idx} style={st.itemRow}>
                          <Feather name={cfg.icon} size={11} color={cfg.color} style={{ marginEnd: 6 }} />
                          <Text style={st.itemName} numberOfLines={1}>{item.name}</Text>
                          <Text style={st.itemPrice}>{item.price} {sym()}</Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })()}

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
            <TouchableOpacity style={[st.saveBtn, { opacity: amount && parseFloat(amount.replace(',', '.')) > 0 ? 1 : 0.35 }]}
              onPress={handleSave} disabled={!amount || parseFloat(amount.replace(',', '.')) <= 0}>
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

function amtFont(val, base) {
  const len = (val || '').length;
  if (len <= 4) return base;
  if (len <= 6) return Math.round(base * 0.8);
  return Math.round(base * 0.65);
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
  detectedRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 6, marginBottom: 8, alignSelf: i18n.row() === 'row' ? 'flex-start' : 'flex-end', paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.green + '15', borderRadius: 8 },
  detectedTxt: { color: colors.green, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  amountRow: { flexDirection: i18n.row(), alignItems: 'center', backgroundColor: colors.bg2, borderRadius: 14, paddingHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.cardBorder },
  currency: { color: colors.green, fontSize: 24, fontWeight: '700', marginEnd: 8 },
  amountInput: { flex: 1, color: colors.text, fontSize: 24, fontWeight: '700', paddingVertical: 14 },
  input: { backgroundColor: colors.bg2, borderRadius: 14, padding: 14, color: colors.text, fontSize: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.cardBorder, textAlign: i18n.textAlign() },

  catChip: { flexDirection: i18n.row(), alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.bg2, marginEnd: 6, borderWidth: 1.5, borderColor: 'transparent', gap: 4 },
  catText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },

  itemsCard: { backgroundColor: colors.bg2, borderRadius: 14, padding: 12, marginBottom: 16 },
  itemsHeader: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemsTitle: { color: colors.textDim, fontSize: 12, fontWeight: '700' },
  itemsSum: { color: colors.text, fontSize: 12, fontWeight: '700' },
  mismatchRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: colors.red + '15', borderRadius: 8, marginBottom: 8 },
  mismatchTxt: { color: colors.red, fontSize: 11, fontWeight: '600', flex: 1 },
  itemRow: { flexDirection: i18n.row(), alignItems: 'center', paddingVertical: 6 },
  itemName: { color: colors.text, fontSize: 12, flex: 1 },
  itemPrice: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  breakdownRow: { flexDirection: i18n.row(), flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  breakdownChip: { flexDirection: i18n.row(), alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  breakdownTxt: { fontSize: 11, fontWeight: '700' },
  splitToggle: { flexDirection: i18n.row(), alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 8, marginBottom: 4, borderRadius: 8, backgroundColor: colors.bg },
  splitToggleActive: { backgroundColor: colors.green + '15' },
  splitToggleTxt: { color: colors.textDim, fontSize: 12, fontWeight: '600', flex: 1, textAlign: i18n.textAlign() },

  btnRow: { flexDirection: i18n.row(), gap: 12, paddingVertical: 12 },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: colors.bg2, alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  cancelText: { color: colors.textDim, fontSize: 16, fontWeight: '600' },
  saveBtn: { flex: 2, flexDirection: i18n.row(), paddingVertical: 16, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', gap: 6 },
  saveText: { color: colors.bg, fontSize: 16, fontWeight: '700' },

  errorCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.redSoft, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.red + '30' },
  errorCardText: { color: colors.red, fontSize: 12, fontWeight: '600', flex: 1 },
  error: { color: colors.red, fontSize: 12, textAlign: 'center', marginTop: 8 },
});
