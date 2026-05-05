// src/components/SmartInputModal.js
// Умный ввод транзакций — пользователь пишет текст, ИИ разбирает
import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const SCREEN_H = Dimensions.get('window').height;
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';

const VOICE_LANG_KEY = 'smart_voice_lang';
const VOICE_LANGS = ['he', 'ru', 'en'];

// Speech recognition — requires dev build
let ExpoSpeechRecognitionModule = null;
let useSpeechRecognitionEvent = (_event, _cb) => {};
try {
  const speech = require('@jamsch/expo-speech-recognition');
  ExpoSpeechRecognitionModule = speech.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = speech.useSpeechRecognitionEvent;
} catch {}
import aiService from '../services/aiService';
import analyticsEvents from '../services/analyticsEvents';
import dataService from '../services/dataService';
import { categoryConfig, colors } from '../theme/colors';
import { fmt } from '../utils/currency';
import Amount from './Amount';
import CategoryPickerModal from './CategoryPickerModal';
import CalculatorModal from './CalculatorModal';

export default function SmartInputModal({ visible, onClose, onSaved }) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const aiPulse = useRef(new Animated.Value(0.4)).current;
  const debounceTimer = useRef(null);
  const lastAIRequestText = useRef(''); // prevent duplicate AI calls for same text
  const [accounts, setAccounts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [voiceLang, setVoiceLang] = useState(() => {
    const ui = i18n.getLanguage();
    return VOICE_LANGS.includes(ui) ? ui : 'en';
  });
  const st = createStyles();
  const hasVoice = !!ExpoSpeechRecognitionModule;

  // Load saved voice language preference
  useEffect(() => {
    AsyncStorage.getItem(VOICE_LANG_KEY).then(saved => {
      if (saved && VOICE_LANGS.includes(saved)) setVoiceLang(saved);
    });
  }, []);

  const cycleVoiceLang = () => {
    const idx = VOICE_LANGS.indexOf(voiceLang);
    const next = VOICE_LANGS[(idx + 1) % VOICE_LANGS.length];
    setVoiceLang(next);
    AsyncStorage.setItem(VOICE_LANG_KEY, next);
  };

  // Voice pulse animation
  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isListening]);

  // Speech recognition events
  useSpeechRecognitionEvent('result', (e) => {
    const transcript = e.results?.[0]?.transcript || '';
    if (transcript) {
      setText(transcript);
      handleTextChange(transcript);
      // Auto-trigger AI parse when final result received
      if (e.isFinal && transcript.length > 3) {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        Keyboard.dismiss(); // ensure keyboard stays hidden so result + chips are visible
        setTimeout(() => handleSmartParse(transcript), 300);
      }
    }
  });
  useSpeechRecognitionEvent('end', () => setIsListening(false));
  useSpeechRecognitionEvent('error', () => setIsListening(false));

  const toggleVoice = async () => {
    if (!hasVoice) return;
    if (isListening) {
      ExpoSpeechRecognitionModule.stop();
      setIsListening(false);
      return;
    }
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) return;
    Keyboard.dismiss(); // hide keyboard so result/chips are visible
    const langCode = voiceLang === 'he' ? 'he-IL' : voiceLang === 'ru' ? 'ru-RU' : 'en-US';
    ExpoSpeechRecognitionModule.start({ lang: langCode, interimResults: true });
    setIsListening(true);
  };

  useEffect(() => {
    if (visible) {
      setText('');
      setParsed(null);
      lastAIRequestText.current = '';
      // Load accounts + projects for smart selection
      dataService.getAccounts().then(accs => setAccounts(accs.filter(a => a.isActive !== false)));
      dataService.getProjects().then(setProjects);
      // Don't auto-focus the input — keyboard would pop up immediately and cover
      // the modal. User taps the mic for voice or the input for typing when ready.
    } else {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      if (isListening && ExpoSpeechRecognitionModule) {
        ExpoSpeechRecognitionModule.stop();
        setIsListening(false);
      }
    }
  }, [visible]);

  useEffect(() => {
    if (parsed) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [parsed]);

  const [aiLoading, setAiLoading] = useState(false);

  // AI loading pulse animation
  useEffect(() => {
    if (aiLoading) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(aiPulse, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(aiPulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      aiPulse.setValue(0.4);
    }
  }, [aiLoading]);

  const handleTextChange = (val) => {
    setText(val);
    if (val.length > 3) {
      // Clear stale AI result so the previous Result Card doesn't briefly flash
      // with wrong chips while the user edits the text.
      setParsed(null);
      setIsPending(true);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        setIsPending(false);
        if (!isListening) handleSmartParse(val);
      }, 1000);
    } else {
      setParsed(null);
      setIsPending(false);
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    }
  };

  const handleSmartParse = async (overrideText) => {
    const t = (overrideText !== undefined ? overrideText : text);
    if (!t || t.length < 3) return;
    if (lastAIRequestText.current === t) return; // already requested same text
    lastAIRequestText.current = t;
    setIsPending(false); // AI is taking over — debounce/dictation phase done
    setAiLoading(true);
    // Ensure accounts and projects are loaded before AI call (race-condition guard)
    let accs = accounts;
    if (accs.length === 0) {
      accs = (await dataService.getAccounts()).filter(a => a.isActive !== false);
      setAccounts(accs);
    }
    let projs = projects;
    if (projs.length === 0) {
      projs = await dataService.getProjects();
      setProjects(projs);
    }
    console.log('[SmartUI] sending to AI — accounts:', accs.length, 'projects:', projs.length, projs.map(p => p.name).join('|'));
    const result = await aiService.parseTransactionSmart(t, accs, projs);
    console.log('[SmartUI] setParsed result:', JSON.stringify(result));
    setParsed(result);
    setAiLoading(false);
    // Defensive: clear any "pending" / "listening" state that might have been set
    // by late voice events arriving after the final transcript. Without this,
    // isPending or isListening could remain true and the Result Card stays hidden.
    setIsListening(false);
    setIsPending(false);
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    analyticsEvents.logEvent('smart_input_used', {
      language: i18n.getLanguage(),
      success: !!(result && result.amount),
    });
  };

  const handleSave = async () => {
    if (!parsed) return;
    setSaving(true);
    Keyboard.dismiss();

    const tx = {
      type: parsed.type,
      amount: parsed.amount,
      categoryId: parsed.categoryId,
      recipient: parsed.recipient || '',
      note: parsed.note || '',
      date: new Date().toISOString(),
      account: parsed.account || null,
      projectId: parsed.projectId || null,
    };

    await dataService.addTransaction(tx);
    setSaving(false);
    onSaved?.();
    onClose();
  };

  const cfg = parsed ? (categoryConfig[parsed.categoryId] || categoryConfig.other) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={st.overlay} behavior="padding" keyboardVerticalOffset={0}>
        <View style={st.modal}>
          {/* Header — pinned, never scrolls off-screen even when keyboard opens */}
          <View style={st.header}>
            <TouchableOpacity onPress={onClose} style={st.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Feather name="x" size={22} color={colors.textMuted} />
            </TouchableOpacity>
            <Text style={st.title}>{i18n.t('smartInput')}</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView style={st.scrollBody} contentContainerStyle={{ paddingBottom: 20 }}
            keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Hint */}
          <Text style={st.hint}>{i18n.t('smartInputHint')}</Text>

          {/* Input */}
          <View style={st.inputWrap}>
            {hasVoice && (
              <TouchableOpacity onPress={toggleVoice} onLongPress={cycleVoiceLang} delayLongPress={400} style={st.micWrap}>
                <Animated.View style={{ transform: [{ scale: isListening ? pulseAnim : 1 }] }}>
                  <Feather name={isListening ? 'mic-off' : 'mic'} size={20} color={isListening ? colors.red : colors.green} />
                </Animated.View>
                <View style={st.langBadge}><Text style={st.langBadgeTxt}>{voiceLang.toUpperCase()}</Text></View>
              </TouchableOpacity>
            )}
            {!hasVoice && <Feather name="edit-3" size={20} color={colors.green} style={{ marginStart: 16 }} />}
            <TextInput
              ref={inputRef}
              style={st.input}
              value={text}
              onChangeText={handleTextChange}
              placeholder={isListening ? i18n.t('listening') : i18n.t('smartInputPlaceholder')}
              placeholderTextColor={isListening ? colors.green : colors.textMuted}
              multiline
              autoCorrect={false}
              autoComplete="off"
            />
            {text.length > 3 && (
              <TouchableOpacity style={st.aiBtn} onPress={handleSmartParse} disabled={aiLoading}>
                {aiLoading
                  ? <ActivityIndicator size="small" color={colors.green} />
                  : <Feather name="cpu" size={18} color={colors.green} />
                }
              </TouchableOpacity>
            )}
          </View>

          {/* Examples */}
          {!parsed && !aiLoading && !isListening && !isPending && (
            <View style={st.examples}>
              <Text style={st.exTitle}>{i18n.t('examples')}:</Text>
              {[
                i18n.t('smartExample1'),
                i18n.t('smartExample2'),
                i18n.t('smartExample3'),
              ].map((ex, idx) => (
                <View key={idx} style={st.exRow}>
                  <Feather name="corner-down-right" size={14} color={colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.exText}>{ex}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* AI thinking skeleton — shown while user is editing, dictating, or AI is working */}
          {(aiLoading || isListening || isPending) && (
            <View style={st.skeletonCard}>
              <View style={st.skeletonHeader}>
                <Animated.View style={[st.skeletonIcon, { opacity: aiPulse }]} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Animated.View style={[st.skeletonBar, { width: '60%', opacity: aiPulse }]} />
                  <Animated.View style={[st.skeletonBarSm, { width: '40%', opacity: aiPulse }]} />
                </View>
                <Animated.View style={[st.skeletonAmount, { opacity: aiPulse }]} />
              </View>
              <View style={st.aiThinkingRow}>
                <Animated.View style={[st.aiDot, { opacity: aiPulse, backgroundColor: colors.green }]} />
                <Text style={st.aiThinkingTxt}>✨ AI</Text>
              </View>
            </View>
          )}

          {/* Parsed result — only when fully settled: AI done, no dictation, no pending edit */}
          {parsed && !aiLoading && !isListening && !isPending && (
            <View style={st.resultCard}>
              <View style={st.resultHeader}>
                {/* Tap category icon/name to change */}
                <TouchableOpacity onPress={() => setShowCatPicker(true)} activeOpacity={0.7}
                  style={[st.resultIcon, { backgroundColor: cfg.color + '18' }]}>
                  <Feather name={cfg.icon} size={22} color={cfg.color} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowCatPicker(true)} activeOpacity={0.7} style={{ flex: 1 }}>
                  <View style={st.editableRow}>
                    <Text style={st.resultCategory}>{i18n.t(parsed.categoryId)}</Text>
                    <Feather name="edit-2" size={11} color={colors.textMuted} />
                  </View>
                  {parsed.recipient ? <Text style={st.resultRecipient}>{parsed.recipient}</Text> : null}
                </TouchableOpacity>
                <View>
                  <TouchableOpacity onPress={() => { Keyboard.dismiss(); setShowCalc(true); }} activeOpacity={0.7}>
                    <Amount
                      value={parsed.type === 'expense' ? -parsed.amount : parsed.amount}
                      sign={parsed.type === 'expense'}
                      style={st.resultAmount}
                      color={parsed.type === 'income' ? colors.green : colors.red}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setParsed({ ...parsed, type: parsed.type === 'income' ? 'expense' : 'income' })} activeOpacity={0.7}>
                    <Text style={[st.resultType, { color: parsed.type === 'income' ? colors.green : colors.red }]}>
                      {parsed.type === 'income' ? i18n.t('income') : i18n.t('expense')} ⇄
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {(() => {
                const payable = accounts.filter(a => ['bank', 'credit', 'cash'].includes(a.type));
                if (payable.length === 0) return null;
                let choices;
                // Brand-specific filtering takes priority (Visa/Mastercard/Amex)
                if (parsed.detectedBrand && aiService.CARD_BRAND_KEYWORDS) {
                  const brandKws = aiService.CARD_BRAND_KEYWORDS[parsed.detectedBrand] || [];
                  const brandMatches = payable.filter(a => brandKws.some(kw => (a.name || '').toLowerCase().includes(kw)));
                  choices = brandMatches.length > 0 ? brandMatches : payable;
                } else if (parsed.accountType) {
                  const typeMatches = payable.filter(a => a.type === parsed.accountType);
                  choices = typeMatches.length > 0 ? typeMatches : payable;
                } else {
                  choices = payable;
                }
                return (
                  <View style={st.accountSection}>
                    <Text style={st.accountLabel}>{i18n.t('account')}</Text>
                    <View style={st.accountChips}>
                      {choices.map(acc => {
                        const sel = parsed.account === acc.id;
                        return (
                          <TouchableOpacity key={acc.id}
                            style={[st.accountChip, sel && st.accountChipActive]}
                            onPress={() => setParsed({ ...parsed, account: acc.id })}
                            activeOpacity={0.7}>
                            <Text style={[st.accountChipTxt, sel && st.accountChipTxtActive]} numberOfLines={1}>{acc.name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })()}

              {/* Project chips — only if user has projects */}
              {projects.length > 0 && (
                <View style={st.accountSection}>
                  <Text style={st.accountLabel}>{i18n.t('project')}</Text>
                  <View style={st.accountChips}>
                    {projects.map(p => {
                      const sel = parsed.projectId === p.id;
                      const pc = p.color || '#60a5fa';
                      return (
                        <TouchableOpacity key={p.id}
                          style={[st.accountChip, sel && { borderColor: pc, backgroundColor: pc + '20' }]}
                          onPress={() => setParsed({ ...parsed, projectId: sel ? null : p.id })}
                          activeOpacity={0.7}>
                          <Feather name={p.icon || 'folder'} size={12} color={sel ? pc : colors.textMuted} style={{ marginEnd: 4 }} />
                          <Text style={[st.accountChipTxt, sel && { color: pc, fontWeight: '700' }]} numberOfLines={1}>{p.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              <TouchableOpacity style={st.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
                <Feather name="check" size={20} color={colors.bg} />
                <Text style={st.saveTxt}>{saving ? '...' : i18n.t('confirm')}</Text>
              </TouchableOpacity>
            </View>
          )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <CategoryPickerModal
        visible={showCatPicker}
        onClose={() => setShowCatPicker(false)}
        onSelect={(catId) => {
          setParsed({ ...parsed, categoryId: catId });
          setShowCatPicker(false);
        }}
        type={parsed?.type || 'expense'}
      />

      <CalculatorModal
        visible={showCalc}
        onClose={() => setShowCalc(false)}
        initialValue={String(parsed?.amount || 0)}
        onResult={(n) => {
          const num = parseFloat(n);
          if (!isNaN(num) && num > 0) setParsed({ ...parsed, amount: num });
          setShowCalc(false);
        }}
      />
    </Modal>
  );
}

const createStyles = () => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.bg2, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 20, borderWidth: 1, borderColor: colors.cardBorder, borderBottomWidth: 0, flex: 1, marginTop: Math.round(SCREEN_H * 0.05) },
  scrollBody: { flex: 1 },
  header: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  closeBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center' },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 12, textAlign: 'center', paddingHorizontal: 32, marginBottom: 16 },

  inputWrap: { flexDirection: i18n.row(), alignItems: 'flex-start', backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.cardBorder, marginHorizontal: 20, marginBottom: 16, minHeight: 56 },
  input: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 16, paddingHorizontal: 12, maxHeight: 100 },
  aiBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginTop: 8, marginEnd: 8 },
  micWrap: { alignItems: 'center', justifyContent: 'center', marginStart: 12, marginTop: 14, gap: 2 },
  langBadge: { backgroundColor: colors.bg2, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: colors.cardBorder },
  langBadgeTxt: { color: colors.textDim, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  accountRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 8, paddingTop: 4, paddingBottom: 12 },
  accountTxt: { color: colors.textDim, fontSize: 13, fontWeight: '500' },
  accountSection: { paddingTop: 4, paddingBottom: 16 },
  accountLabel: { color: colors.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8, textAlign: i18n.textAlign() },
  accountChips: { flexDirection: i18n.row(), flexWrap: 'wrap', gap: 8 },
  accountChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.bg2, borderWidth: 1.5, borderColor: 'transparent' },
  accountChipActive: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  accountChipTxt: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  accountChipTxtActive: { color: colors.green, fontWeight: '700' },

  // AI loading skeleton
  skeletonCard: { backgroundColor: colors.card, borderRadius: 20, marginHorizontal: 20, padding: 20, borderWidth: 1, borderColor: colors.cardBorder, gap: 16 },
  skeletonHeader: { flexDirection: i18n.row(), alignItems: 'center', gap: 14 },
  skeletonIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.bg2 },
  skeletonBar: { height: 12, borderRadius: 4, backgroundColor: colors.bg2 },
  skeletonBarSm: { height: 8, borderRadius: 4, backgroundColor: colors.bg2 },
  skeletonAmount: { width: 70, height: 22, borderRadius: 6, backgroundColor: colors.bg2 },
  aiThinkingRow: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'center', gap: 8 },
  aiDot: { width: 8, height: 8, borderRadius: 4 },
  aiThinkingTxt: { color: colors.green, fontSize: 13, fontWeight: '600' },

  // AI improving badge (when local result is shown but AI is still working)
  aiImprovingRow: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: -8, marginBottom: 6 },
  aiImprovingTxt: { color: colors.green, fontSize: 11, fontWeight: '600' },

  // Editable affordances on Result Card
  editableRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 6 },

  examples: { paddingHorizontal: 24, marginBottom: 16 },
  exTitle: { color: colors.textDim, fontSize: 12, fontWeight: '600', marginBottom: 8, textAlign: i18n.textAlign() },
  exRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 8, paddingVertical: 8 },
  exText: { color: colors.textSecondary, fontSize: 14, textAlign: i18n.textAlign() },

  resultCard: { backgroundColor: colors.card, borderRadius: 20, marginHorizontal: 20, padding: 20, borderWidth: 1, borderColor: colors.cardBorder },
  resultHeader: { flexDirection: i18n.row(), alignItems: 'center', gap: 14, marginBottom: 16 },
  resultIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  resultCategory: { color: colors.text, fontSize: 16, fontWeight: '700' },
  resultRecipient: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  resultAmount: { fontSize: 20, fontWeight: '800', textAlign: i18n.textAlign() },
  resultType: { color: colors.textMuted, fontSize: 12, fontWeight: '600', textAlign: i18n.textAlign(), marginTop: 2 },

  taxRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 8, backgroundColor: colors.bg2, borderRadius: 12, padding: 12, marginBottom: 16 },
  taxText: { color: colors.yellow, fontSize: 12, fontWeight: '600', flex: 1 },

  saveBtn: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.green, borderRadius: 14, paddingVertical: 16 },
  saveTxt: { color: colors.bg, fontSize: 16, fontWeight: '700' },
});
