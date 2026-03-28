// src/screens/InvestmentsScreen.js
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Card from '../components/Card';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { colors } from '../theme/colors';
import { sym } from '../utils/currency';

export default function InvestmentsScreen() {
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

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{i18n.t('investments')}</Text>
        </View>

        <Card style={styles.totalCard}>
          <Text style={styles.totalLabel}>{i18n.t('totalInvested')}</Text>
          <Text style={styles.totalAmount}>{sym()} {totalInvested.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
          <View style={styles.monthlyRow}>
            <Text style={styles.monthlyLabel}>{i18n.t('monthlyContribution')}</Text>
            <Text style={styles.monthlyAmount}>{sym()} {totalMonthly.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
          </View>
        </Card>

        {investments.map(inv => (
          <Card key={inv.id} style={{ marginHorizontal: 20 }}>
            <View style={styles.invRow}>
              <Text style={styles.invIcon}>{inv.icon}</Text>
              <View style={styles.invInfo}>
                <Text style={styles.invName}>{inv.name}</Text>
                <Text style={styles.invType}>{i18n.t(inv.type)}</Text>
              </View>
              <View style={styles.invAmounts}>
                <Text style={styles.invBalance}>{inv.currency} {(inv.balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                {inv.monthly > 0 && (
                  <Text style={styles.invMonthly}>+{inv.monthly}/mo</Text>
                )}
              </View>
            </View>
          </Card>
        ))}

        <Card style={{ marginHorizontal: 20, marginTop: 12 }}>
          <Text style={styles.infoTitle}>📊 {i18n.t('investments')}</Text>
          <Text style={styles.infoText}>
            Track your pension, Kupat Gemel, Keren Hishtalmut, and children's savings.
            Tap any item to update balances manually.
            PDF/Excel import from investment houses coming in Phase 2.
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
  totalCard: { marginHorizontal: 20, borderWidth: 1, borderColor: 'rgba(52,211,153,0.12)' },
  totalLabel: { color: colors.textDim, fontSize: 13, marginBottom: 8 },
  totalAmount: { color: colors.text, fontSize: 32, fontWeight: '800', marginBottom: 16 },
  monthlyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  monthlyLabel: { color: colors.textDim, fontSize: 13 },
  monthlyAmount: { color: colors.green, fontSize: 16, fontWeight: '700' },
  invRow: { flexDirection: 'row', alignItems: 'center' },
  invIcon: { fontSize: 28, marginEnd: 14 },
  invInfo: { flex: 1 },
  invName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  invType: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  invAmounts: { alignItems: 'flex-end' },
  invBalance: { color: colors.text, fontSize: 17, fontWeight: '700' },
  invMonthly: { color: colors.green, fontSize: 12, marginTop: 2 },
  infoTitle: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 8 },
  infoText: { color: colors.textDim, fontSize: 13, lineHeight: 20 },
});