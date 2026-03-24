// src/navigation/AppNavigator.js
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
 
const icons = {
  Dashboard: '📊',
  Transactions: '📋',
  Accounts: '🏦',
  Investments: '📈',
  Settings: '⚙️',
};
 
const labelKeys = {
  Dashboard: 'dashboard',
  Transactions: 'transactions',
  Accounts: 'accounts',
  Investments: 'investments',
  Settings: 'language',
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
          <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
            <Text style={[styles.icon, focused && styles.iconActive]}>
              {icons[route.name]}
            </Text>
          </View>
        ),
        tabBarLabel: ({ focused }) => (
          <Text style={[styles.label, focused && styles.labelActive]}>
            {route.name === 'Settings' 
              ? (i18n.getLanguage() === 'ru' ? 'Ещё' : i18n.getLanguage() === 'he' ? 'עוד' : 'More')
              : i18n.t(labelKeys[route.name])}
          </Text>
        ),
      })}
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
    width: 40,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.greenSoft,
  },
  icon: {
    fontSize: 20,
    opacity: 0.45,
  },
  iconActive: {
    opacity: 1,
    fontSize: 22,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
  },
  labelActive: {
    color: colors.green,
    fontWeight: '700',
  },
});