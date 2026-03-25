// src/navigation/AppNavigator.js
// Векторные иконки Feather в табах
import { Feather } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, View } from 'react-native';
import i18n from '../i18n';
import { colors } from '../theme/colors';

import AccountsScreen from '../screens/AccountsScreen';
import DashboardScreen from '../screens/DashboardScreen';
import InvestmentsScreen from '../screens/InvestmentsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TransactionsScreen from '../screens/TransactionsScreen';

const Tab = createBottomTabNavigator();

const tabConfig = {
  Dashboard:    { icon: 'home',       labelKey: 'dashboard' },
  Transactions: { icon: 'list',       labelKey: 'transactions' },
  Accounts:     { icon: 'credit-card', labelKey: 'accounts' },
  Investments:  { icon: 'trending-up', labelKey: 'investments' },
  Settings:     { icon: 'settings',    labelKey: null },
};

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const cfg = tabConfig[route.name];
        return {
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: colors.green,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarIcon: ({ focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Feather
                name={cfg.icon}
                size={focused ? 22 : 20}
                color={focused ? colors.green : colors.textMuted}
              />
            </View>
          ),
          tabBarLabel: ({ focused }) => (
            <Text style={[styles.label, focused && styles.labelActive]}>
              {route.name === 'Settings'
                ? (i18n.getLanguage() === 'ru' ? 'Ещё' : i18n.getLanguage() === 'he' ? 'עוד' : 'More')
                : i18n.t(cfg.labelKey)}
            </Text>
          ),
        };
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Accounts" component={AccountsScreen} />
      <Tab.Screen name="Investments" component={InvestmentsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.bg2,
    borderTopColor: colors.divider,
    borderTopWidth: 1,
    height: 88,
    paddingTop: 8,
    paddingBottom: 28,
    paddingHorizontal: 4,
  },
  iconWrap: {
    width: 40, height: 32, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.greenSoft,
  },
  label: {
    fontSize: 10, fontWeight: '600',
    color: colors.textMuted, marginTop: 2,
  },
  labelActive: {
    color: colors.green, fontWeight: '700',
  },
});