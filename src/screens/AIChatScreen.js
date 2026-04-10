// src/screens/AIChatScreen.js
// AI Chat — free-form financial questions answered by Gemini, with voice input and chart rendering
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Svg, { Rect, Line, Text as SvgText, G, Path, Circle } from 'react-native-svg';
// Speech recognition — requires dev build, graceful fallback for Expo Go
let ExpoSpeechRecognitionModule = null;
let useSpeechRecognitionEvent = (_event, _cb) => {};
try {
  const speech = require('@jamsch/expo-speech-recognition');
  ExpoSpeechRecognitionModule = speech.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = speech.useSpeechRecognitionEvent;
} catch {
  // Not available in Expo Go — voice input disabled
}
import i18n from '../i18n';
import aiService from '../services/aiService';
import dataService from '../services/dataService';
import { categoryConfig, colors } from '../theme/colors';
import { sym } from '../utils/currency';
import Amount from '../components/Amount';

const SUGGESTIONS = {
  en: ['What do I spend most on?', 'Show expenses this week', 'How can I save more?', 'Compare income vs expenses'],
  ru: ['На что я трачу больше всего?', 'Покажи расходы за неделю', 'Как мне сэкономить?', 'Сравни доходы и расходы'],
  he: ['על מה אני מוציא הכי הרבה?', 'הראה הוצאות השבוע', 'איך אני יכול לחסוך?', 'השווה הכנסות מול הוצאות'],
};

// ─── PIE CHART COLORS ───────────────────────────────────
const PIE_COLORS = ['#fb7185', '#f97316', '#fb923c', '#a78bfa', '#60a5fa', '#22d3ee', '#2dd4bf', '#f59e0b'];

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// ─── INLINE CHART COMPONENTS ────────────────────────────

function ChatBarChart({ data }) {
  const maxVal = Math.max(...data.map(d => d.amount), 1);
  const barCount = data.length;
  const chartW = 280;
  const chartH = 120;
  const padLeft = 40;
  const padBot = 20;
  const barW = Math.max(4, (chartW - padLeft) / barCount - 2);

  return (
    <View style={{ alignItems: 'center', marginTop: 8 }}>
      <Svg width={chartW} height={chartH + padBot}>
        {/* Y-axis labels */}
        <SvgText x={padLeft - 4} y={14} fontSize={9} fill={colors.textMuted} textAnchor="end">{formatK(maxVal)}</SvgText>
        <SvgText x={padLeft - 4} y={chartH / 2 + 4} fontSize={9} fill={colors.textMuted} textAnchor="end">{formatK(maxVal / 2)}</SvgText>
        {/* Bars */}
        {data.map((d, idx) => {
          const barH = Math.max((d.amount / maxVal) * (chartH - 10), 1);
          const x = padLeft + idx * ((chartW - padLeft) / barCount) + 1;
          return (
            <G key={idx}>
              <Rect
                x={x}
                y={chartH - barH}
                width={barW}
                height={barH}
                rx={2}
                fill={d.amount > 0 ? colors.green : colors.card}
                opacity={0.85}
              />
              {/* X-axis label - show every few */}
              {(idx === 0 || idx === barCount - 1 || idx === Math.floor(barCount / 2)) && (
                <SvgText x={x + barW / 2} y={chartH + 14} fontSize={8} fill={colors.textMuted} textAnchor="middle">{d.date}</SvgText>
              )}
            </G>
          );
        })}
        {/* Baseline */}
        <Line x1={padLeft} y1={chartH} x2={chartW} y2={chartH} stroke={colors.textMuted} strokeWidth={0.5} opacity={0.3} />
      </Svg>
    </View>
  );
}

function ChatCashFlowChart({ data, totalIncome, totalExpense }) {
  const maxIncome = Math.max(...data.map(d => d.income), 1);
  const maxExpense = Math.max(...data.map(d => d.expense), 1);
  const maxVal = Math.max(maxIncome, maxExpense);
  const barCount = data.length;
  const chartW = 280;
  const midY = 65;
  const halfH = 55;
  const padLeft = 40;
  const barW = Math.max(2, (chartW - padLeft) / barCount - 2);

  return (
    <View style={{ alignItems: 'center', marginTop: 8 }}>
      {/* Summary */}
      <View style={{ flexDirection: i18n.row(), justifyContent: 'center', gap: 16, marginBottom: 6 }}>
        <Text style={{ color: colors.green, fontSize: 12, fontWeight: '600' }}>+{Math.round(totalIncome)} {sym()}</Text>
        <Text style={{ color: colors.red, fontSize: 12, fontWeight: '600' }}>-{Math.round(totalExpense)} {sym()}</Text>
      </View>
      <Svg width={chartW} height={midY * 2 + 20}>
        {/* Center line */}
        <Line x1={padLeft} y1={midY} x2={chartW} y2={midY} stroke={colors.textMuted} strokeWidth={0.5} opacity={0.3} />
        {data.map((d, idx) => {
          const x = padLeft + idx * ((chartW - padLeft) / barCount) + 1;
          const incH = maxVal > 0 ? (d.income / maxVal) * halfH : 0;
          const expH = maxVal > 0 ? (d.expense / maxVal) * halfH : 0;
          return (
            <G key={idx}>
              {/* Income bar (up) */}
              {d.income > 0 && <Rect x={x} y={midY - incH} width={barW} height={incH} rx={1} fill={colors.green} opacity={0.8} />}
              {/* Expense bar (down) */}
              {d.expense > 0 && <Rect x={x} y={midY} width={barW} height={expH} rx={1} fill={colors.red} opacity={0.8} />}
              {(idx === 0 || idx === barCount - 1 || idx === Math.floor(barCount / 2)) && (
                <SvgText x={x + barW / 2} y={midY * 2 + 14} fontSize={8} fill={colors.textMuted} textAnchor="middle">{d.date}</SvgText>
              )}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

function ChatPieChart({ data }) {
  const total = data.reduce((s, d) => s + d.amount, 0);
  if (total === 0) return null;
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;

  let currentAngle = 0;
  const slices = data.map((item, idx) => {
    const pct = item.amount / total;
    const angle = pct * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;
    const color = (categoryConfig[item.name] || {}).color || PIE_COLORS[idx % PIE_COLORS.length];
    return { ...item, startAngle, endAngle, pct, color };
  });

  return (
    <View style={{ alignItems: 'center', marginTop: 8 }}>
      <Svg width={size} height={size}>
        {slices.map((s, idx) => {
          if (s.pct < 0.01) return null;
          const start = polarToCartesian(cx, cy, r, s.endAngle);
          const end = polarToCartesian(cx, cy, r, s.startAngle);
          const largeArc = s.endAngle - s.startAngle > 180 ? 1 : 0;
          const d = `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
          return <Path key={idx} d={d} fill={s.color} opacity={0.85} />;
        })}
        {/* Center circle (donut) */}
        <Circle cx={cx} cy={cy} r={r * 0.5} fill={colors.card} />
        <SvgText x={cx} y={cy + 4} fontSize={12} fill={colors.text} fontWeight="bold" textAnchor="middle">{Math.round(total)} {sym()}</SvgText>
      </Svg>
      {/* Legend */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 8, maxWidth: 260 }}>
        {slices.map((s, idx) => (
          <View key={idx} style={{ flexDirection: i18n.row(), alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
            <Text style={{ color: colors.textDim, fontSize: 10 }}>{i18n.t(s.name) || s.name} {Math.round(s.pct * 100)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function formatK(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

// ─── MAIN SCREEN ────────────────────────────────────────

export default function AIChatScreen() {
  const navigation = useNavigation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [txData, setTxData] = useState({ transactions: [], budgets: {} });
  const [isListening, setIsListening] = useState(false);
  const flatListRef = useRef(null);
  const inputRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const st = createSt();
  const lang = i18n.getLanguage();

  useFocusEffect(useCallback(() => {
    Promise.all([dataService.getTransactions(), dataService.getBudgets()]).then(([txs, bdg]) => {
      setTxData({ transactions: txs, budgets: bdg });
    });
  }, []));

  // ─── Voice recognition ─────────────────────────────────
  useSpeechRecognitionEvent('result', (ev) => {
    const text = ev.results[0]?.transcript || '';
    if (ev.isFinal && text) {
      setInput(text);
      setIsListening(false);
    } else if (text) {
      setInput(text);
    }
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
  });

  useSpeechRecognitionEvent('error', () => {
    setIsListening(false);
  });

  // Pulse animation for mic
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

  const hasVoice = !!ExpoSpeechRecognitionModule;

  const toggleVoice = async () => {
    if (!hasVoice) return;

    if (isListening) {
      ExpoSpeechRecognitionModule.stop();
      setIsListening(false);
      return;
    }

    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) return;

    const langCode = lang === 'he' ? 'he-IL' : lang === 'ru' ? 'ru-RU' : 'en-US';
    ExpoSpeechRecognitionModule.start({ lang: langCode, interimResults: true });
    setIsListening(true);
  };

  // ─── Send message (with chart detection) ───────────────
  const sendMessage = async (text) => {
    const q = text || input.trim();
    if (!q || loading) return;
    setInput('');

    if (isListening) {
      ExpoSpeechRecognitionModule.stop();
      setIsListening(false);
    }

    const userMsg = { id: Date.now().toString(), role: 'user', text: q };
    setMessages(prev => [...prev, userMsg]);

    setLoading(true);

    // Check if the query needs a chart
    const [chartParams, answer] = await Promise.all([
      aiService.interpretChartQuery(q, txData.transactions, lang),
      aiService.chatWithAI(q, txData.transactions, txData.budgets, lang),
    ]);

    let chartData = null;
    if (chartParams) {
      chartData = aiService.buildChartData(chartParams, txData.transactions);
    }

    const aiMsg = {
      id: (Date.now() + 1).toString(),
      role: 'ai',
      text: answer,
      chart: chartData,
      chartTitle: chartParams?.title || null,
    };
    setMessages(prev => [...prev, aiMsg]);
    setLoading(false);

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const suggestions = SUGGESTIONS[lang] || SUGGESTIONS.en;

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[st.msgRow, isUser ? st.msgRowUser : st.msgRowAI]}>
        {!isUser && (
          <View style={st.aiAvatar}>
            <Feather name="cpu" size={16} color={colors.green} />
          </View>
        )}
        <View style={[st.bubble, isUser ? st.bubbleUser : st.bubbleAI, item.chart && { maxWidth: '92%' }]}>
          <Text style={[st.msgText, isUser && { color: colors.bg }]}>{item.text}</Text>
          {/* Chart rendering */}
          {item.chart && (
            <View style={st.chartWrap}>
              {item.chartTitle && <Text style={st.chartTitle}>{item.chartTitle}</Text>}
              {item.chart.type === 'bar' && <ChatBarChart data={item.chart.data} />}
              {item.chart.type === 'cashflow' && <ChatCashFlowChart data={item.chart.data} totalIncome={item.chart.totalIncome} totalExpense={item.chart.totalExpense} />}
              {item.chart.type === 'pie' && <ChatPieChart data={item.chart.data} />}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={st.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
          <Feather name={i18n.backIcon()} size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={st.headerCenter}>
          <Text style={st.headerTitle}>{i18n.t('aiChat')}</Text>
          <Text style={st.headerPrivacy}>{i18n.t('aiPrivacy')}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={st.messagesList}
        ListEmptyComponent={
          <View style={st.emptyWrap}>
            <View style={st.emptyIcon}>
              <Feather name="message-circle" size={40} color={colors.green} />
            </View>
            <Text style={st.emptyTitle}>{i18n.t('aiChatWelcome')}</Text>
            <Text style={st.emptyHint}>{i18n.t('aiChatHint')}</Text>

            {/* Suggestions */}
            <View style={st.suggestionsWrap}>
              {suggestions.map((s, idx) => (
                <TouchableOpacity key={idx} style={st.suggestionBtn} onPress={() => sendMessage(s)}>
                  <Text style={st.suggestionText}>{s}</Text>
                  <Feather name="arrow-up-right" size={14} color={colors.green} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
        onContentSizeChange={() => messages.length > 0 && flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Loading */}
      {loading && (
        <View style={st.loadingRow}>
          <View style={st.aiAvatar}>
            <Feather name="cpu" size={14} color={colors.green} />
          </View>
          <ActivityIndicator size="small" color={colors.green} />
          <Text style={st.loadingText}>{i18n.t('aiThinking')}</Text>
        </View>
      )}

      {/* Input */}
      <View style={st.inputRow}>
        {/* Mic button — only shown when speech recognition available (dev build) */}
        {hasVoice && (
          <TouchableOpacity onPress={toggleVoice} style={st.micBtn}>
            <Animated.View style={[
              st.micInner,
              isListening && st.micListening,
              { transform: [{ scale: pulseAnim }] },
            ]}>
              <Feather name={isListening ? 'mic-off' : 'mic'} size={18} color={isListening ? colors.red : colors.green} />
            </Animated.View>
          </TouchableOpacity>
        )}

        <TextInput
          ref={inputRef}
          style={st.input}
          value={input}
          onChangeText={setInput}
          placeholder={isListening ? i18n.t('listening') : i18n.t('askQuestion')}
          placeholderTextColor={isListening ? colors.green : colors.textMuted}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={() => sendMessage()}
          blurOnSubmit
        />
        <TouchableOpacity style={[st.sendBtn, (!input.trim() || loading) && { opacity: 0.3 }]}
          onPress={() => sendMessage()} disabled={!input.trim() || loading}>
          <Feather name="send" size={18} color={colors.bg} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const createSt = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: i18n.row(), alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },
  headerSub: { color: colors.green, fontSize: 12, fontWeight: '600', marginTop: 1 },
  headerPrivacy: { color: colors.textMuted, fontSize: 10, marginTop: 2 },

  messagesList: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  msgRow: { marginBottom: 12 },
  msgRowUser: { alignItems: i18n.isRTL() ? 'flex-start' : 'flex-end' },
  msgRowAI: { flexDirection: i18n.row(), alignItems: 'flex-start', gap: 8 },
  aiAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.greenSoft, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  bubble: { maxWidth: '80%', borderRadius: 18, padding: 14 },
  bubbleUser: { backgroundColor: colors.green, borderBottomRightRadius: i18n.isRTL() ? 18 : 4, borderBottomLeftRadius: i18n.isRTL() ? 4 : 18 },
  bubbleAI: { backgroundColor: colors.card, borderBottomLeftRadius: i18n.isRTL() ? 18 : 4, borderBottomRightRadius: i18n.isRTL() ? 4 : 18, borderWidth: 1, borderColor: colors.cardBorder },
  msgText: { color: colors.text, fontSize: 14, lineHeight: 22 },

  chartWrap: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.divider },
  chartTitle: { color: colors.text, fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 4 },

  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.greenSoft, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptyHint: { color: colors.textDim, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  suggestionsWrap: { width: '100%', gap: 8 },
  suggestionBtn: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.cardBorder },
  suggestionText: { color: colors.text, fontSize: 14, fontWeight: '500', flex: 1, textAlign: i18n.textAlign() },

  loadingRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  loadingText: { color: colors.textMuted, fontSize: 12 },

  inputRow: { flexDirection: i18n.row(), alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.bg2, gap: 8 },
  micBtn: { justifyContent: 'center', alignItems: 'center' },
  micInner: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  micListening: { backgroundColor: colors.redSoft, borderColor: colors.red },
  input: { flex: 1, backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, color: colors.text, fontSize: 14, maxHeight: 100, borderWidth: 1, borderColor: colors.cardBorder, textAlign: i18n.textAlign() },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center' },
});
