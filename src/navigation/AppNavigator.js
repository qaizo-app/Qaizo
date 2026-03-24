// src/navigation/AppNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import i18n from '../i18n';

import DashboardScreen from '../screens/DashboardScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import AccountsScreen from '../screens/AccountsScreen';
import InvestmentsScreen from '../screens/InvestmentsScreen';
import AIAdvisorScreen from '../screens/AIAdvisorScreen';

const Tab = createBottomTabNavigator();

const icons = {
  Dashboard: '📊',
  Transactions: '📋',
  Accounts: '🏦',
  Investments: '📈',
  Advisor: '🤖',
};

const labelKeys = {
  Dashboard: 'dashboard',
  Transactions: 'transactions',
  Accounts: 'accounts',
  Investments: 'investments',
  Advisor: 'advisor',
};

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ focused }) => (
          <Text style={[styles.icon, focused && styles.iconActive]}>
            {icons[route.name]}
          </Text>
        ),
        tabBarLabel: ({ focused }) => (
          <Text style={[styles.label, focused && styles.labelActive]}>
            {i18n.t(labelKeys[route.name])}
          </Text>
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Accounts" component={AccountsScreen} />
      <Tab.Screen name="Investments" component={InvestmentsScreen} />
      <Tab.Screen name="Advisor" component={AIAdvisorScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.bg2,
    borderTopColor: 'rgba(255,255,255,0.04)',
    borderTopWidth: 1,
    height: 85,
    paddingTop: 8,
    paddingBottom: 28,
  },
  icon: {
    fontSize: 22,
    opacity: 0.5,
  },
  iconActive: {
    opacity: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
  },
  labelActive: {
    color: colors.green,
  },
});
