// src/screens/AIChatScreen.js
// AI Chat — free-form financial questions answered by Gemini
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import aiService from '../services/aiService';
import dataService from '../services/dataService';
import { colors } from '../theme/colors';

const SUGGESTIONS = {
  en: ['What do I spend most on?', 'How can I save more?', 'Am I within budget?', 'Compare this month to last'],
  ru: ['На что я трачу больше всего?', 'Как мне сэкономить?', 'Укладываюсь ли я в бюджет?', 'Сравни этот месяц с прошлым'],
  he: ['על מה אני מוציא הכי הרבה?', 'איך אני יכול לחסוך?', 'האם אני בתקציב?', 'השווה חודש זה לקודם'],
};

export default function AIChatScreen() {
  const navigation = useNavigation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [txData, setTxData] = useState({ transactions: [], budgets: {} });
  const flatListRef = useRef(null);
  const inputRef = useRef(null);
  const st = createSt();
  const lang = i18n.getLanguage();

  useFocusEffect(useCallback(() => {
    Promise.all([dataService.getTransactions(), dataService.getBudgets()]).then(([txs, bdg]) => {
      setTxData({ transactions: txs, budgets: bdg });
    });
  }, []));

  const sendMessage = async (text) => {
    const q = text || input.trim();
    if (!q || loading) return;
    setInput('');

    const userMsg = { id: Date.now().toString(), role: 'user', text: q };
    setMessages(prev => [...prev, userMsg]);

    setLoading(true);
    const answer = await aiService.chatWithAI(q, txData.transactions, txData.budgets, lang);
    const aiMsg = { id: (Date.now() + 1).toString(), role: 'ai', text: answer };
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
        <View style={[st.bubble, isUser ? st.bubbleUser : st.bubbleAI]}>
          <Text style={[st.msgText, isUser && { color: colors.bg }]}>{item.text}</Text>
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
          <Text style={st.headerSub}>Qaizo AI</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
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
        <TextInput
          ref={inputRef}
          style={st.input}
          value={input}
          onChangeText={setInput}
          placeholder={i18n.t('askQuestion')}
          placeholderTextColor={colors.textMuted}
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
  headerTitle: { color: colors.text, fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  headerSub: { color: colors.green, fontSize: 11, fontWeight: '600', marginTop: 1 },

  messagesList: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  msgRow: { marginBottom: 12 },
  msgRowUser: { alignItems: i18n.isRTL() ? 'flex-start' : 'flex-end' },
  msgRowAI: { flexDirection: i18n.row(), alignItems: 'flex-start', gap: 8 },
  aiAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.greenSoft, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  bubble: { maxWidth: '80%', borderRadius: 18, padding: 14 },
  bubbleUser: { backgroundColor: colors.green, borderBottomRightRadius: i18n.isRTL() ? 18 : 4, borderBottomLeftRadius: i18n.isRTL() ? 4 : 18 },
  bubbleAI: { backgroundColor: colors.card, borderBottomLeftRadius: i18n.isRTL() ? 18 : 4, borderBottomRightRadius: i18n.isRTL() ? 4 : 18, borderWidth: 1, borderColor: colors.cardBorder },
  msgText: { color: colors.text, fontSize: 15, lineHeight: 22 },

  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.greenSoft, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyHint: { color: colors.textDim, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  suggestionsWrap: { width: '100%', gap: 8 },
  suggestionBtn: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.cardBorder },
  suggestionText: { color: colors.text, fontSize: 14, fontWeight: '500', flex: 1, textAlign: i18n.textAlign() },

  loadingRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  loadingText: { color: colors.textMuted, fontSize: 13 },

  inputRow: { flexDirection: i18n.row(), alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.bg2, gap: 10 },
  input: { flex: 1, backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, color: colors.text, fontSize: 15, maxHeight: 100, borderWidth: 1, borderColor: colors.cardBorder, textAlign: i18n.textAlign() },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center' },
});
