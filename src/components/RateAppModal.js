// src/components/RateAppModal.js
// Two-step rate prompt: pick stars, then either open Play Store (4-5★) or
// collect feedback in-app (1-3★). Routing low ratings inward keeps negative
// reviews out of the public listing while still surfacing the pain point.
import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import i18n from '../i18n';
import { useToast } from './ToastProvider';
import feedbackService from '../services/feedbackService';
import { colors } from '../theme/colors';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.qaizo.app';
const POSITIVE_THRESHOLD = 4;

const CHIP_KEYS = [
  'rateChipAi',
  'rateChipSync',
  'rateChipMissing',
  'rateChipSlow',
  'rateChipBug',
  'rateChipOther',
];

export default function RateAppModal({ visible, onClose }) {
  const [stars, setStars] = useState(0);
  const [step, setStep] = useState('rate'); // 'rate' | 'feedback'
  const [chip, setChip] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const st = createSt();

  useEffect(() => {
    if (visible) {
      setStars(0);
      setStep('rate');
      setChip('');
      setText('');
      setBusy(false);
    }
  }, [visible]);

  const handleStarPress = (n) => {
    setStars(n);
    if (n >= POSITIVE_THRESHOLD) {
      Linking.openURL(PLAY_STORE_URL).catch(() => {});
      feedbackService.markSubmitted().catch(() => {});
      onClose?.();
    } else {
      setStep('feedback');
    }
  };

  const handleDismiss = () => {
    feedbackService.markDismissed().catch(() => {});
    onClose?.();
  };

  const handleSubmit = async () => {
    if (busy) return;
    const hasContent = chip || text.trim().length >= 6;
    if (!hasContent) return;
    setBusy(true);
    try {
      await feedbackService.submitFeedback({
        rating: stars,
        chip,
        text: text.trim(),
        language: i18n.getLanguage(),
        platform: Platform.OS,
      });
      toast.show(i18n.t('rateThanks'));
      onClose?.();
    } catch (e) {
      toast.show(i18n.t('rateSendFailed'));
      setBusy(false);
    }
  };

  const title = step === 'rate' ? i18n.t('rateTitle') : i18n.t('rateFeedbackTitle');
  const subtitle = step === 'rate' ? i18n.t('rateSubtitle') : i18n.t('rateFeedbackSubtitle');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDismiss}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={st.overlay}>
        <View style={st.modal}>
          <TouchableOpacity style={st.closeBtn} onPress={handleDismiss} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <Feather name="x" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={[st.iconWrap, { backgroundColor: `${colors.green}15` }]}>
            <Feather name="star" size={28} color={colors.green} />
          </View>

          <Text style={st.title}>{title}</Text>
          <Text style={st.subtitle}>{subtitle}</Text>

          {step === 'rate' ? (
            <View style={st.stars}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity key={n} onPress={() => handleStarPress(n)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Feather
                    name="star"
                    size={36}
                    color={n <= stars ? colors.yellow : colors.textMuted}
                    style={{ marginHorizontal: 4, opacity: n <= stars ? 1 : 0.5 }}
                  />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={st.chipRow}
              >
                {CHIP_KEYS.map(k => {
                  const active = chip === k;
                  return (
                    <TouchableOpacity
                      key={k}
                      style={[st.chip, active && st.chipActive]}
                      onPress={() => setChip(active ? '' : k)}
                    >
                      <Text style={[st.chipText, active && st.chipTextActive]}>{i18n.t(k)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TextInput
                style={st.input}
                value={text}
                onChangeText={setText}
                placeholder={i18n.t('rateFeedbackPlaceholder')}
                placeholderTextColor={colors.textMuted}
                multiline
                textAlignVertical="top"
                maxLength={2000}
              />

              <View style={st.buttonRow}>
                <TouchableOpacity style={st.cancelBtn} onPress={handleDismiss} disabled={busy}>
                  <Text style={st.cancelText}>{i18n.t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    st.submitBtn,
                    (!chip && text.trim().length < 6) && st.submitBtnDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={busy || (!chip && text.trim().length < 6)}
                >
                  {busy
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={st.submitText}>{i18n.t('rateSend')}</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createSt = () => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modal: {
    backgroundColor: colors.bg2,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 6,
    zIndex: 2,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16, marginTop: 8,
  },
  title: {
    color: colors.text, fontSize: 20, fontWeight: '700',
    textAlign: 'center', marginBottom: 8,
  },
  subtitle: {
    color: colors.textDim, fontSize: 14, textAlign: 'center',
    lineHeight: 20, marginBottom: 20,
  },
  stars: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginVertical: 8, marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row', gap: 8, paddingBottom: 12, paddingHorizontal: 4,
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder,
  },
  chipActive: {
    backgroundColor: `${colors.green}20`, borderColor: colors.green,
  },
  chipText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.green },
  input: {
    width: '100%', minHeight: 100, maxHeight: 160,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder,
    borderRadius: 14, padding: 12, color: colors.text, fontSize: 14,
    marginBottom: 16, textAlign: i18n.textAlign(),
  },
  buttonRow: { flexDirection: i18n.row(), gap: 12, width: '100%' },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: colors.card, alignItems: 'center',
    borderWidth: 1, borderColor: colors.cardBorder,
  },
  cancelText: { color: colors.textDim, fontSize: 15, fontWeight: '600' },
  submitBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: colors.green, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
