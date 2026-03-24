// src/screens/AccountsScreen.js
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import i18n from '../i18n';
import Card from '../components/Card';
import dataService from '../services/dataService';

export default function AccountsScreen() {
  const [accounts, setAccounts] = useState([]);

  useFocusEffect(useCallback(() => {
    const load = async () => {
      const accs = await dataService.getAccounts();
      setAccounts(accs);
    };
    load();
  }, []));

  const grouped = {
    bank: accounts.filter(a => a.type === 'bank'),
    credit: accounts.filter(a => a.type === 'credit'),
    cash: accounts.filter(a => a.type === 'cash'),
  };

  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{i18n.t('accounts')}</Text>
        </View>

        <Card style={styles.totalCard}>
          <Text style={styles.totalLabel}>{i18n.t('totalAssets')}</Text>
          <Text style={styles.totalAmount}>₪ {totalBalance.toLocaleString()}</Text>
        </Card>

        {Object.entries(grouped).map(([type, accs]) => (
          accs.length > 0 && (
            <View key={type}>
              <Text style={styles.groupTitle}>{i18n.t(type)}</Text>
              {accs.map(acc => (
                <Card key={acc.id}>
                  <View style={styles.accRow}>
                    <Text style={styles.accIcon}>{acc.icon}</Text>
                    <View style={styles.accInfo}>
                      <Text style={styles.accName}>{acc.name}</Text>
                      <Text style={styles.accType}>{i18n.t(acc.type)}</Text>
                    </View>
                    <Text style={styles.accBalance}>{acc.currency} {(acc.balance || 0).toLocaleString()}</Text>
                  </View>
                </Card>
              ))}
            </View>
          )
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  totalCard: { marginHorizontal: 20, borderWidth: 1, borderColor: 'rgba(52,211,153,0.12)' },
  totalLabel: { color: colors.textDim, fontSize: 13, marginBottom: 8 },
  totalAmount: { color: colors.text, fontSize: 32, fontWeight: '800' },
  groupTitle: { color: colors.textDim, fontSize: 13, fontWeight: '600', paddingHorizontal: 20, marginTop: 24, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  accRow: { flexDirection: 'row', alignItems: 'center' },
  accIcon: { fontSize: 28, marginRight: 14 },
  accInfo: { flex: 1 },
  accName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  accType: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  accBalance: { color: colors.text, fontSize: 17, fontWeight: '700' },
});
