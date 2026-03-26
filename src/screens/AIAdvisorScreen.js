// src/screens/AIAdvisorScreen.js
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Card from '../components/Card';
import i18n from '../i18n';
import { colors } from '../theme/colors';

export default function AIAdvisorScreen() {
  const tips = [
    { icon: '🛒', title: 'Shopping', text: 'Based on your purchase patterns, you could save ~₪200/month by switching from Shufersal to Rami Levy for basic products.' },
    { icon: '📱', title: 'Cellular', text: 'Your Golan Telecom plan at ₪29/month is already competitive. No action needed.' },
    { icon: '🏦', title: 'Bank fees', text: 'You paid ₪833/month in bank commissions last year. Consider switching to a digital bank like One Zero for lower fees.' },
    { icon: '⚡', title: 'Electricity', text: 'Your average electricity bill is ₪554/month. Consider a solar panel installation — payback in ~4 years.' },
    { icon: '🛡️', title: 'Insurance', text: 'Review your car insurance — comparing 3+ providers could save you ₪1,000-3,000/year.' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{i18n.t('advisor')}</Text>
        </View>

        <Card style={styles.greetCard}>
          <Text style={styles.greetIcon}>🤖</Text>
          <Text style={styles.greetText}>{i18n.t('aiGreeting')}</Text>
          <Text style={styles.greetSub}>{i18n.t('aiAnalyzing')}</Text>
        </Card>

        <Text style={styles.sectionTitle}>💡 {i18n.t('aiTip')}</Text>

        {tips.map((tip, idx) => (
          <Card key={idx} style={{ marginHorizontal: 20 }}>
            <View style={styles.tipHeader}>
              <Text style={styles.tipIcon}>{tip.icon}</Text>
              <Text style={styles.tipTitle}>{tip.title}</Text>
            </View>
            <Text style={styles.tipText}>{tip.text}</Text>
          </Card>
        ))}

        <Card style={{ marginHorizontal: 20, marginTop: 8 }}>
          <Text style={styles.comingTitle}>🚀 Coming Soon</Text>
          <Text style={styles.comingText}>
            • Receipt scanning with price comparison{'\n'}
            • Smart shopping list auto-generation{'\n'}
            • Personalized savings plan{'\n'}
            • Insurance and pension optimization
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  greetCard: { marginHorizontal: 20, alignItems: 'center', paddingVertical: 28, borderWidth: 1, borderColor: 'rgba(52,211,153,0.12)' },
  greetIcon: { fontSize: 40, marginBottom: 12 },
  greetText: { color: colors.text, fontSize: 17, fontWeight: '600', marginBottom: 4 },
  greetSub: { color: colors.textMuted, fontSize: 13 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', paddingHorizontal: 20, marginTop: 28, marginBottom: 12 },
  tipHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  tipIcon: { fontSize: 20, marginEnd: 8 },
  tipTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  tipText: { color: colors.textDim, fontSize: 13, lineHeight: 20 },
  comingTitle: { color: colors.green, fontSize: 15, fontWeight: '600', marginBottom: 8 },
  comingText: { color: colors.textDim, fontSize: 13, lineHeight: 22 },
});