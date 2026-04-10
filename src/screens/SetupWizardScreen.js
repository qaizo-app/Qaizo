// src/screens/SetupWizardScreen.js
// Пошаговый визард при первом запуске: валюта → счёт → транзакция → готово
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Dimensions, KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { accountTypeConfig, categoryConfig, colors } from '../theme/colors';
import CurrencyPickerModal from '../components/CurrencyPickerModal';
import { CURRENCIES as CURRENCY_LIST, setCurrency as setGlobalCurrency, sym } from '../utils/currency';

const { width: SW } = Dimensions.get('window');
const ACCOUNT_TYPES = ['bank', 'credit', 'cash'];
const EXPENSE_CATS = ['food', 'transport', 'fuel', 'health', 'phone', 'utilities', 'rent', 'restaurant', 'other'];

export default function SetupWizardScreen({ onDone }) {
  const [step, setStep] = useState(0); // 0=валюта, 1=счёт, 2=транзакция, 3=готово

  // Шаг 0: Валюта
  const [currency, setCurrency] = useState(sym());
  const [currencyCode, setCurrencyCode] = useState('ILS');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  // Шаг 1: Счёт
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState('bank');
  const [accBalance, setAccBalance] = useState('');

  // Шаг 2: Транзакция
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState('food');
  const [txRecipient, setTxRecipient] = useState('');

  // Созданные объекты
  const [createdAccount, setCreatedAccount] = useState(null);
  const st = createSt();

  const totalSteps = 4;
  const progress = ((step + 1) / totalSteps) * 100;

  const handleSaveCurrency = async () => {
    const settings = await dataService.getSettings();
    await dataService.saveSettings({ ...settings, currency });
    setGlobalCurrency(currency, currencyCode);
    setStep(1);
  };

  const handleSaveAccount = async () => {
    if (!accName.trim()) return;
    const cfg = accountTypeConfig[accType] || accountTypeConfig.bank;
    const acc = await dataService.addAccount({
      name: accName.trim(),
      type: accType,
      currency,
      balance: parseFloat(accBalance.replace(',', '.')) || 0,
      isActive: true,
      icon: cfg.icon,
    });
    setCreatedAccount(acc);
    setStep(2);
  };

  const handleSaveTransaction = async () => {
    const parsed = parseFloat(txAmount.replace(',', '.'));
    if (!txAmount || !parsed || parsed <= 0) return;
    const cfg = categoryConfig[txCategory] || categoryConfig.other;
    await dataService.addTransaction({
      type: 'expense',
      amount: parsed,
      categoryId: txCategory,
      icon: cfg.icon,
      recipient: txRecipient.trim(),
      note: '',
      currency,
      date: new Date().toISOString(),
      account: createdAccount?.id || '',
      tags: [],
    });
    setStep(3);
  };

  const handleSkipTransaction = () => setStep(3);

  const typeLabel = (id) => {
    const map = { bank: i18n.t('bank'), credit: i18n.t('credit'), cash: i18n.t('cash') };
    return map[id] || id;
  };

  return (
    <View style={st.container}>
      {/* Прогресс */}
      <View style={st.progressRow}>
        <View style={st.progressBg}>
          <View style={[st.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={st.stepLabel}>{step + 1}/{totalSteps}</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior='padding'>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">

        {/* ─── ШАГ 0: ВАЛЮТА ─────────────────────── */}
        {step === 0 && (
          <View style={st.stepWrap}>
            <View style={[st.stepIcon, { backgroundColor: 'rgba(96,165,250,0.15)' }]}>
              <Feather name="dollar-sign" size={36} color={colors.blue} />
            </View>
            <Text style={st.stepTitle}>{i18n.t('wizCurrencyTitle')}</Text>
            <Text style={st.stepSub}>{i18n.t('wizCurrencySub')}</Text>

            <TouchableOpacity style={st.currPickerBtn} onPress={() => setShowCurrencyPicker(true)} activeOpacity={0.7}>
              <Text style={st.currPickerSymbol}>{currency}</Text>
              <Text style={st.currPickerCode}>{currencyCode}</Text>
              <Feather name="chevron-down" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={st.primaryBtn} onPress={handleSaveCurrency}>
              <Text style={st.primaryTxt}>{i18n.t('next')}</Text>
              <Feather name="arrow-right" size={18} color={colors.bg} style={{ marginStart: 6 }} />
            </TouchableOpacity>
          </View>
        )}

        {/* ─── ШАГ 1: ПЕРВЫЙ СЧЁТ ───────────────── */}
        {step === 1 && (
          <View style={st.stepWrap}>
            <View style={[st.stepIcon, { backgroundColor: 'rgba(52,211,153,0.15)' }]}>
              <MaterialCommunityIcons name="bank-outline" size={36} color={colors.green} />
            </View>
            <Text style={st.stepTitle}>{i18n.t('wizAccountTitle')}</Text>
            <Text style={st.stepSub}>{i18n.t('wizAccountSub')}</Text>

            <Text style={st.fieldLabel}>{i18n.t('type')}</Text>
            <View style={st.typeRow}>
              {ACCOUNT_TYPES.map(t => {
                const cfg = accountTypeConfig[t];
                const sel = accType === t;
                return (
                  <TouchableOpacity key={t}
                    style={[st.typeBtn, sel && { borderColor: cfg.color, backgroundColor: `${cfg.color}12` }]}
                    onPress={() => setAccType(t)}>
                    <MaterialCommunityIcons name={cfg.icon} size={20} color={sel ? cfg.color : colors.textMuted} />
                    <Text style={[st.typeTxt, sel && { color: cfg.color }]}>{typeLabel(t)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={st.fieldLabel}>{i18n.t('name')}</Text>
            <TextInput style={st.input} value={accName} onChangeText={setAccName}
              placeholder={i18n.t('wizAccountPlaceholder')} placeholderTextColor={colors.textMuted} />

            <Text style={st.fieldLabel}>{i18n.t('balance')}</Text>
            <View style={st.balRow}>
              <Text style={st.balCur}>{currency}</Text>
              <TextInput style={st.balInput} value={accBalance} onChangeText={setAccBalance}
                keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textMuted} />
            </View>

            <TouchableOpacity style={[st.primaryBtn, { opacity: accName.trim() ? 1 : 0.4 }]}
              onPress={handleSaveAccount} disabled={!accName.trim()}>
              <Text style={st.primaryTxt}>{i18n.t('next')}</Text>
              <Feather name="arrow-right" size={18} color={colors.bg} style={{ marginStart: 6 }} />
            </TouchableOpacity>
          </View>
        )}

        {/* ─── ШАГ 2: ПЕРВАЯ ТРАНЗАКЦИЯ ─────────── */}
        {step === 2 && (
          <View style={st.stepWrap}>
            <View style={[st.stepIcon, { backgroundColor: 'rgba(251,113,133,0.15)' }]}>
              <Feather name="shopping-cart" size={36} color={colors.red} />
            </View>
            <Text style={st.stepTitle}>{i18n.t('wizTxTitle')}</Text>
            <Text style={st.stepSub}>{i18n.t('wizTxSub')}</Text>

            <Text style={st.fieldLabel}>{i18n.t('amount')}</Text>
            <View style={st.balRow}>
              <Text style={[st.balCur, { color: colors.red }]}>{currency}</Text>
              <TextInput style={st.balInput} value={txAmount} onChangeText={setTxAmount}
                keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textMuted} />
            </View>

            <Text style={st.fieldLabel}>{i18n.t('category')}</Text>
            <View style={st.catGrid}>
              {EXPENSE_CATS.map(cid => {
                const cfg = categoryConfig[cid] || categoryConfig.other;
                const sel = txCategory === cid;
                return (
                  <TouchableOpacity key={cid}
                    style={[st.catBtn, sel && { borderColor: cfg.color, backgroundColor: `${cfg.color}12` }]}
                    onPress={() => setTxCategory(cid)}>
                    <Feather name={cfg.icon} size={18} color={sel ? cfg.color : colors.textMuted} />
                    <Text style={[st.catTxt, sel && { color: cfg.color }]}>{i18n.t(cid)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={st.fieldLabel}>{i18n.t('payee')}</Text>
            <TextInput style={st.input} value={txRecipient} onChangeText={setTxRecipient}
              placeholder={i18n.t('wizTxPlaceholder')} placeholderTextColor={colors.textMuted} />

            <View style={st.twoBtn}>
              <TouchableOpacity style={st.skipBtn} onPress={handleSkipTransaction}>
                <Text style={st.skipTxt}>{i18n.t('skip')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.primaryBtn, { flex: 2, opacity: txAmount && parseFloat(txAmount.replace(',', '.')) > 0 ? 1 : 0.4 }]}
                onPress={handleSaveTransaction} disabled={!txAmount || parseFloat(txAmount.replace(',', '.')) <= 0}>
                <Text style={st.primaryTxt}>{i18n.t('next')}</Text>
                <Feather name="arrow-right" size={18} color={colors.bg} style={{ marginStart: 6 }} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ─── ШАГ 3: ГОТОВО ────────────────────── */}
        {step === 3 && (
          <View style={st.stepWrap}>
            <View style={[st.stepIcon, { backgroundColor: 'rgba(52,211,153,0.15)' }]}>
              <Feather name="check-circle" size={48} color={colors.green} />
            </View>
            <Text style={st.stepTitle}>{i18n.t('wizDoneTitle')}</Text>
            <Text style={st.stepSub}>{i18n.t('wizDoneSub')}</Text>

            <View style={st.doneCard}>
              {createdAccount && (
                <View style={st.doneRow}>
                  <Feather name="check" size={16} color={colors.green} />
                  <Text style={st.doneTxt}>{i18n.t('account')}: {createdAccount.name}</Text>
                </View>
              )}
              {txAmount && parseFloat(txAmount) > 0 && (
                <View style={st.doneRow}>
                  <Feather name="check" size={16} color={colors.green} />
                  <Text style={st.doneTxt}>{i18n.t('wizFirstTx')}: {currency}{txAmount}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity style={st.primaryBtn} onPress={onDone}>
              <Text style={st.primaryTxt}>{i18n.t('getStarted')}</Text>
              <Feather name="arrow-right" size={18} color={colors.bg} style={{ marginStart: 6 }} />
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
      </KeyboardAvoidingView>
      <CurrencyPickerModal visible={showCurrencyPicker}
        onClose={() => setShowCurrencyPicker(false)}
        selected={currencyCode}
        onSelect={(cur) => { setCurrency(cur.symbol); setCurrencyCode(cur.code); }} />
    </View>
  );
}

const createSt = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  progressRow: { flexDirection: i18n.row(), alignItems: 'center', paddingHorizontal: 24, paddingTop: 60, gap: 12 },
  progressBg: { flex: 1, height: 4, backgroundColor: colors.card, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: colors.green, borderRadius: 2 },
  stepLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },

  content: { flexGrow: 1, paddingTop: 24, paddingBottom: 40 },
  stepWrap: { paddingHorizontal: 24, alignItems: 'center' },

  stepIcon: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  stepTitle: { color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  stepSub: { color: colors.textDim, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 28 },

  fieldLabel: { color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8, alignSelf: 'stretch' },
  input: { backgroundColor: colors.card, borderRadius: 14, padding: 14, color: colors.text, fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.cardBorder, alignSelf: 'stretch' },

  optionGrid: { flexDirection: i18n.row(), gap: 12, marginBottom: 28 },
  currPickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: colors.cardBorder, gap: 12, alignSelf: 'stretch' },
  currPickerSymbol: { color: colors.text, fontSize: 24, fontWeight: '700', width: 40, textAlign: 'center' },
  currPickerCode: { color: colors.textSecondary, fontSize: 16, fontWeight: '600', flex: 1 },

  typeRow: { flexDirection: i18n.row(), gap: 10, marginBottom: 16, alignSelf: 'stretch' },
  typeBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: colors.cardBorder, gap: 4 },
  typeTxt: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },

  balRow: { flexDirection: i18n.row(), alignItems: 'center', marginBottom: 20, alignSelf: 'stretch' },
  balCur: { color: colors.green, fontSize: 32, fontWeight: '700', marginEnd: 8 },
  balInput: { flex: 1, color: colors.text, fontSize: 32, fontWeight: '700' },

  catGrid: { flexDirection: i18n.row(), flexWrap: 'wrap', gap: 8, marginBottom: 16, alignSelf: 'stretch' },
  catBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: colors.cardBorder, flexDirection: i18n.row(), alignItems: 'center', gap: 6 },
  catTxt: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },

  twoBtn: { flexDirection: i18n.row(), gap: 12, alignSelf: 'stretch' },
  skipBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, alignItems: 'center' },
  skipTxt: { color: colors.textDim, fontSize: 16, fontWeight: '600' },

  primaryBtn: { flexDirection: i18n.row(), alignSelf: 'stretch', paddingVertical: 16, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  primaryTxt: { color: colors.bg, fontSize: 16, fontWeight: '700' },

  doneCard: { alignSelf: 'stretch', backgroundColor: colors.card, borderRadius: 16, padding: 20, marginBottom: 24, gap: 12 },
  doneRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 10 },
  doneTxt: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
});