// src/navigation/AppNavigator.js
import { Feather } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import i18n from '../i18n';
import { colors } from '../theme/colors';

import AccountHistoryScreen from '../screens/AccountHistoryScreen';
import AccountsScreen from '../screens/AccountsScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import DashboardScreen from '../screens/DashboardScreen';
import MonthlyReportScreen from '../screens/MonthlyReportScreen';
import InvestmentsScreen from '../screens/InvestmentsScreen';
import AIAdvisorScreen from '../screens/AIAdvisorScreen';
import AIChatScreen from '../screens/AIChatScreen';
import CalendarScreen from '../screens/CalendarScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TransactionsScreen from '../screens/TransactionsScreen';

const Tab = createBottomTabNavigator();
const AccountsStack = createNativeStackNavigator();
const DashboardStack = createNativeStackNavigator();

function AccountsStackScreen() {
  return (
    <AccountsStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'fade' }}>
      <AccountsStack.Screen name="AccountsList" component={AccountsScreen} />
      <AccountsStack.Screen name="AccountHistory" component={AccountHistoryScreen} />
    </AccountsStack.Navigator>
  );
}

function DashboardStackScreen() {
  return (
    <DashboardStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'fade' }}>
      <DashboardStack.Screen name="DashboardMain" component={DashboardScreen} />
      <DashboardStack.Screen name="Settings" component={SettingsScreen} />
      <DashboardStack.Screen name="Categories" component={CategoriesScreen} />
      <DashboardStack.Screen name="MonthlyReport" component={MonthlyReportScreen} />
      <DashboardStack.Screen name="AIAdvisor" component={AIAdvisorScreen} />
      <DashboardStack.Screen name="Investments" component={InvestmentsScreen} />
      <DashboardStack.Screen name="AIChat" component={AIChatScreen} />
    </DashboardStack.Navigator>
  );
}

// Пустой экран для таба "+" (нажатие перехватывается)
function EmptyScreen() { return <View style={{ flex: 1, backgroundColor: colors.bg }} />; }

const tabConfig = {
  Dashboard:    { icon: 'home',        labelKey: 'dashboard',    color: colors.green },
  Transactions: { icon: 'list',        labelKey: 'transactions', color: '#60a5fa' },
  Add:          { icon: 'plus',        labelKey: null,           color: colors.green },
  AccountsTab:  { icon: 'credit-card', labelKey: 'accounts',     color: '#f59e0b' },
  Calendar:     { icon: 'calendar',    labelKey: 'calendarView', color: '#a78bfa' },
};

export default function AppNavigator() {
  const [, setLangVer] = useState(0);
  useEffect(() => i18n.onLanguageChange(() => setLangVer(v => v + 1)), []);
  const insets = useSafeAreaInsets();
  const tabBarHeight = 60 + Math.max(insets.bottom, 16);
  const styles = createStyles();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const cfg = tabConfig[route.name];
        return {
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.bg2,
            borderTopColor: colors.divider,
            borderTopWidth: 1,
            height: tabBarHeight,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 16),
            paddingHorizontal: 4,
          },
          tabBarActiveTintColor: cfg.color,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarIcon: ({ focused }) => {
            if (route.name === 'Add') {
              return (
                <View style={styles.addBtn}>
                  <Feather name="plus" size={28} color={colors.bg} />
                </View>
              );
            }
            return (
              <View style={[styles.iconWrap, focused && { backgroundColor: cfg.color + '14' }]}>
                <Feather name={cfg.icon} size={focused ? 22 : 20} color={focused ? cfg.color : colors.textMuted} />
              </View>
            );
          },
          tabBarLabel: ({ focused }) => {
            if (route.name === 'Add') return null;
            return (
              <Text style={[styles.label, focused && { color: cfg.color, fontWeight: '700' }]}>
                {i18n.t(cfg.labelKey)}
              </Text>
            );
          },
        };
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardStackScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Add" component={EmptyScreen}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('Transactions', { openAdd: true });
          },
        })}
      />
      <Tab.Screen name="AccountsTab" component={AccountsStackScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
    </Tab.Navigator>
  );
}

const createStyles = () => StyleSheet.create({
  iconWrap: { width: 40, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 10, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
  addBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center', marginBottom: 20, shadowColor: colors.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
});