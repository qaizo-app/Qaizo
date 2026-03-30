// src/screens/InvestmentsScreen.js
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Amount from '../components/Amount';
import Card from '../components/Card';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { colors } from '../theme/colors';

export default function InvestmentsScreen() {
  const navigation = useNavigation();
  const [investments, setInvestments] = useState([]);

  const styles = createStyles();

  useFocusEffect(useCallback(() => {
    const load = async () => {
      const inv = await dataService.getInvestments();
      setInvestments(inv);
    };
    load();
  }, []));

  const totalInvested = investments.reduce((sum, i) => sum + (i.balance || 0), 0);
  const totalMonthly = investments.reduce((sum, i) => sum + (i.monthly || 0), 0);

  const typeIcon = (type) => {
    switch (type) {
      case 'pension': return 'shield';
      case 'savings': return 'trending-up';
      case 'education': return 'book-open';
      case 'stocks': return 'bar-chart-2';
      case 'bonds': return 'layers';
      case 'real_estate': return 'home';
      case 'crypto': return 'cpu';
      case 'children': return 'smile';
      default: return 'briefcase';
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name={i18n.backIcon()} size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{i18n.t('investments')}</Text>
          <View style={{ width: 44 }} />
        </View>

        <Card style={styles.totalCard}>
          <Text style={styles.totalLabel}>{i18n.t('totalInvested')}</Text>
          <Amount value={totalInvested} style={styles.totalAmount} numberOfLines={1} adjustsFontSizeToFit />
          <View style={styles.monthlyRow}>
            <Text style={styles.monthlyLabel}>{i18n.t('monthlyContribution')}</Text>
            <Amount value={totalMonthly} style={styles.monthlyAmount} />
          </View>
        </Card>

        {investments.map(inv => (
          <Card key={inv.id} style={{ marginHorizontal: 20 }}>
            <View style={styles.invRow}>
              <View style={[styles.invIconWrap, { backgroundColor: colors.teal + '18' }]}>
                <Feather name={typeIcon(inv.type)} size={20} color={colors.teal} />
              </View>
              <View style={styles.invInfo}>
                <Text style={styles.invName}>{inv.name}</Text>
                <Text style={styles.invType}>{i18n.t(inv.type)}</Text>
              </View>
              <View style={styles.invAmounts}>
                <Amount value={inv.balance || 0} style={styles.invBalance} numberOfLines={1} adjustsFontSizeToFit />
                {inv.monthly > 0 && (
                  <Text style={styles.invMonthly}>+{inv.monthly.toLocaleString()} / {i18n.t('month')}</Text>
                )}
              </View>
            </View>
          </Card>
        ))}

        {investments.length === 0 && (
          <Card style={{ marginHorizontal: 20, marginTop: 12 }}>
            <View style={styles.emptyWrap}>
              <Feather name="trending-up" size={32} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>{i18n.t('noInvestments')}</Text>
              <Text style={styles.emptyText}>{i18n.t('investmentsHint')}</Text>
            </View>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', marginEnd: 14, borderWidth: 1, borderColor: colors.cardBorder },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', flex: 1, textAlign: 'center' },
  totalCard: { marginHorizontal: 20, borderWidth: 1, borderColor: 'rgba(52,211,153,0.12)' },
  totalLabel: { color: colors.textDim, fontSize: 13, marginBottom: 8, textAlign: i18n.textAlign() },
  totalAmount: { color: colors.text, fontSize: 32, fontWeight: '800', marginBottom: 16, textAlign: i18n.textAlign() },
  monthlyRow: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  monthlyLabel: { color: colors.textDim, fontSize: 13 },
  monthlyAmount: { color: colors.green, fontSize: 16, fontWeight: '700' },
  invRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 12 },
  invIconWrap: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  invInfo: { flex: 1 },
  invName: { color: colors.text, fontSize: 16, fontWeight: '600', textAlign: i18n.textAlign() },
  invType: { color: colors.textMuted, fontSize: 12, marginTop: 2, textAlign: i18n.textAlign() },
  invAmounts: { alignItems: i18n.isRTL() ? 'flex-start' : 'flex-end' },
  invBalance: { color: colors.text, fontSize: 17, fontWeight: '700' },
  invMonthly: { color: colors.green, fontSize: 12, marginTop: 2 },
  emptyWrap: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  emptyText: { color: colors.textDim, fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 12 },
});
