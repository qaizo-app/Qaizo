// src/screens/AIAdvisorScreen.js
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Card from '../components/Card';
import i18n from '../i18n';
import { colors } from '../theme/colors';
import { sym } from '../utils/currency';

export default function AIAdvisorScreen() {
  const styles = createStyles();
  const s = sym();
  const tips = [
    { icon: '🛒', titleKey: 'aiTip1Title', textKey: 'aiTip1Text' },
    { icon: '📱', titleKey: 'aiTip2Title', textKey: 'aiTip2Text' },
    { icon: '🏦', titleKey: 'aiTip3Title', textKey: 'aiTip3Text' },
    { icon: '⚡', titleKey: 'aiTip4Title', textKey: 'aiTip4Text' },
    { icon: '🛡️', titleKey: 'aiTip5Title', textKey: 'aiTip5Text' },
  ];

  const fmt = (key) => i18n.t(key).replace(/\{sym\}/g, s);

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
              <Text style={styles.tipTitle}>{i18n.t(tip.titleKey)}</Text>
            </View>
            <Text style={styles.tipText}>{fmt(tip.textKey)}</Text>
          </Card>
        ))}

        <Card style={{ marginHorizontal: 20, marginTop: 8 }}>
          <Text style={styles.comingTitle}>🚀 {i18n.t('aiComingSoon')}</Text>
          <Text style={styles.comingText}>
            • {i18n.t('aiFeature1')}{'\n'}
            • {i18n.t('aiFeature2')}{'\n'}
            • {i18n.t('aiFeature3')}{'\n'}
            • {i18n.t('aiFeature4')}
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const createStyles = () => StyleSheet.create({
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