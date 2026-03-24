// src/screens/DashboardScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import i18n from '../i18n';
import Card from '../components/Card';
import TransactionItem from '../components/TransactionItem';
import AddTransactionModal from '../components/AddTransactionModal';
import dataService from '../services/dataService';

export default function DashboardScreen() {
  const [transactions, setTransactions] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [, forceUpdate] = useState(0);

  const loadData = async () => {
    const txs = await dataService.getTransactions();
    setTransactions(txs);
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const thisMonth = transactions.filter(t => {
    const d = new Date(t.date || t.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const totalIncome = thisMonth.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = thisMonth.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const recentTx = transactions.slice(0, 5);

  const cycleLang = () => {
    const langs = ['ru', 'he', 'en'];
    const idx = langs.indexOf(i18n.getLanguage());
    i18n.setLanguage(langs[(idx + 1) % 3]);
    forceUpdate(n => n + 1);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>Qaizo</Text>
            <Text style={styles.subtitle}>{i18n.t('thisMonth')}</Text>
          </View>
          <TouchableOpacity style={styles.langBtn} onPress={cycleLang}>
            <Text style={styles.langText}>{i18n.getLanguage().toUpperCase()}</Text>
          </TouchableOpacity>
        </View>

        {/* Balance Card */}
        <Card style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{i18n.t('totalBalance')}</Text>
          <Text style={styles.balanceAmount}>₪ {balance.toLocaleString()}</Text>
          <View style={styles.incExpRow}>
            <View style={styles.incExpItem}>
              <Text style={styles.incLabel}>↑ {i18n.t('income')}</Text>
              <Text style={styles.incAmount}>₪ {totalIncome.toLocaleString()}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.incExpItem}>
              <Text style={styles.expLabel}>↓ {i18n.t('expenses')}</Text>
              <Text style={styles.expAmount}>₪ {totalExpense.toLocaleString()}</Text>
            </View>
          </View>
        </Card>

        {/* Recent Transactions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{i18n.t('recentTransactions')}</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>{i18n.t('seeAll')}</Text>
          </TouchableOpacity>
        </View>

        <Card>
          {recentTx.length > 0 ? (
            recentTx.map((tx) => (
              <TransactionItem key={tx.id} transaction={tx} />
            ))
          ) : (
            <Text style={styles.empty}>{i18n.t('noTransactions')}</Text>
          )}
        </Card>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAdd(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <AddTransactionModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={() => loadData()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  logo: {
    color: colors.green,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -1,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  langBtn: {
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  langText: {
    color: colors.green,
    fontSize: 14,
    fontWeight: '700',
  },
  balanceCard: {
    marginHorizontal: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.12)',
  },
  balanceLabel: {
    color: colors.textDim,
    fontSize: 13,
    marginBottom: 8,
  },
  balanceAmount: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 20,
  },
  incExpRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  incExpItem: {
    flex: 1,
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 16,
  },
  incLabel: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  incAmount: {
    color: colors.green,
    fontSize: 18,
    fontWeight: '700',
  },
  expLabel: {
    color: colors.red,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  expAmount: {
    color: colors.red,
    fontSize: 18,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  seeAll: {
    color: colors.green,
    fontSize: 13,
    fontWeight: '600',
  },
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 30,
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.green,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: {
    color: colors.bg,
    fontSize: 28,
    fontWeight: '700',
    marginTop: -2,
  },
});
