// src/navigation/AppNavigator.js
import { Feather } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import i18n from '../i18n';
import dataService from '../services/dataService';
import { categoryConfig, colors } from '../theme/colors';

import AccountHistoryScreen from '../screens/AccountHistoryScreen';
import AccountsScreen from '../screens/AccountsScreen';
import AddRecurringModal from '../components/AddRecurringModal';
import AddTransactionModal from '../components/AddTransactionModal';
import CategoriesScreen from '../screens/CategoriesScreen';
import DashboardScreen from '../screens/DashboardScreen';
import MonthlyReportScreen from '../screens/MonthlyReportScreen';
import InvestmentsScreen from '../screens/InvestmentsScreen';
import AIAdvisorScreen from '../screens/AIAdvisorScreen';
import AIChatScreen from '../screens/AIChatScreen';
import CalendarScreen from '../screens/CalendarScreen';
import ReceiptScannerModal from '../components/ReceiptScannerModal';
import ProjectsScreen from '../screens/ProjectsScreen';
import QuickAddModal from '../components/QuickAddModal';
import SettingsScreen from '../screens/SettingsScreen';
import SmartInputModal from '../components/SmartInputModal';
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
      <DashboardStack.Screen name="Projects" component={ProjectsScreen} />
      <DashboardStack.Screen name="AIChat" component={AIChatScreen} />
    </DashboardStack.Navigator>
  );
}

function EmptyScreen() { return <View style={{ flex: 1, backgroundColor: colors.bg }} />; }

const tabConfig = {
  Dashboard:    { icon: 'home',        labelKey: 'dashboard',    color: colors.green },
  Transactions: { icon: 'list',        labelKey: 'transactions', color: '#60a5fa' },
  Add:          { icon: 'plus',        labelKey: null,           color: colors.green },
  AccountsTab:  { icon: 'credit-card', labelKey: 'accounts',     color: '#f59e0b' },
  Calendar:     { icon: 'calendar',    labelKey: 'calendarView', color: '#a78bfa' },
};

const ADD_MENU = [
  { key: 'smartInput',      icon: 'cpu',       color: '#a78bfa' },
  { key: 'scanReceipt',     icon: 'camera',    color: colors.teal },
  { key: 'oneTimePayment',  icon: 'plus-circle', color: colors.green },
  { key: 'recurringPayment', icon: 'repeat',   color: '#60a5fa' },
  { key: 'quickAdd',        icon: 'zap',       color: '#f59e0b' },
];

export default function AppNavigator() {
  const [, setLangVer] = useState(0);
  useEffect(() => i18n.onLanguageChange(() => setLangVer(v => v + 1)), []);
  const insets = useSafeAreaInsets();
  const tabBarHeight = 60 + Math.max(insets.bottom, 16);
  const styles = createStyles();
  // Add menu state
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showSmartInput, setShowSmartInput] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showQuickSelect, setShowQuickSelect] = useState(false);
  const [quickTemplate, setQuickTemplate] = useState(null);
  const [quickTemplates, setQuickTemplates] = useState([]);
  const [quickTab, setQuickTab] = useState('categories');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const openAddMenu = () => {
    setShowAddMenu(true);
    Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  };

  const closeAddMenu = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setShowAddMenu(false);
    });
  };

  const handleMenuPress = (key) => {
    closeAddMenu();
    setTimeout(() => {
      if (key === 'smartInput') setShowSmartInput(true);
      else if (key === 'scanReceipt') setShowReceipt(true);
      else if (key === 'oneTimePayment') setShowAdd(true);
      else if (key === 'recurringPayment') setShowRecurring(true);
      else if (key === 'quickAdd') {
        dataService.getQuickTemplates().then(t => setQuickTemplates(t));
        setShowQuickSelect(true);
      }
    }, 200);
  };

  return (
    <View style={{ flex: 1 }}>
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
          listeners={() => ({
            tabPress: (e) => {
              e.preventDefault();
              if (showAddMenu) closeAddMenu();
              else openAddMenu();
            },
          })}
        />
        <Tab.Screen name="AccountsTab" component={AccountsStackScreen} />
        <Tab.Screen name="Calendar" component={CalendarScreen} />
      </Tab.Navigator>

      {/* Add Menu Overlay */}
      {showAddMenu && (
        <Animated.View style={[styles.menuOverlay, { opacity: fadeAnim }]}>
          <TouchableOpacity style={styles.menuOverlayBg} activeOpacity={1} onPress={closeAddMenu} />
          <Animated.View style={[styles.menuContainer, {
            transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }],
          }]}>
            {ADD_MENU.map((item, idx) => (
              <TouchableOpacity key={item.key} style={styles.menuItem} onPress={() => handleMenuPress(item.key)} activeOpacity={0.7}>
                <View style={[styles.menuIcon, { backgroundColor: item.color + '20' }]}>
                  <Feather name={item.icon} size={22} color={item.color} />
                </View>
                <Text style={styles.menuText}>{i18n.t(item.key)}</Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        </Animated.View>
      )}

      {/* Quick Select Overlay */}
      {showQuickSelect && (
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowQuickSelect(false)}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.quickSheet} activeOpacity={1}>
            <Text style={styles.quickTitle}>{i18n.t('quickAdd')}</Text>

            {/* Tabs */}
            <View style={styles.quickTabs}>
              <TouchableOpacity style={[styles.quickTabBtn, quickTab === 'categories' && styles.quickTabActive]} onPress={() => setQuickTab('categories')}>
                <Feather name="grid" size={14} color={quickTab === 'categories' ? colors.green : colors.textMuted} />
                <Text style={[styles.quickTabTxt, quickTab === 'categories' && { color: colors.green }]}>{i18n.t('categories')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.quickTabBtn, quickTab === 'templates' && styles.quickTabActive]} onPress={() => setQuickTab('templates')}>
                <Feather name="bookmark" size={14} color={quickTab === 'templates' ? colors.green : colors.textMuted} />
                <Text style={[styles.quickTabTxt, quickTab === 'templates' && { color: colors.green }]}>{i18n.t('templates')}</Text>
              </TouchableOpacity>
            </View>

            {quickTab === 'templates' ? (
              <View>
                {quickTemplates.length > 0 ? (
                  <View style={styles.quickGrid}>
                    {quickTemplates.map((tpl, idx) => {
                      const cfg = categoryConfig[tpl.categoryId] || categoryConfig.other;
                      return (
                        <TouchableOpacity key={idx} style={styles.quickBtn}
                          onPress={() => { setShowQuickSelect(false); setQuickTemplate(tpl); }} activeOpacity={0.7}>
                          <View style={[styles.quickIcon, { backgroundColor: cfg.color + '18' }]}>
                            <Feather name={cfg.icon} size={20} color={cfg.color} />
                          </View>
                          <Text style={styles.quickLabel} numberOfLines={1}>{tpl.name || i18n.t(tpl.categoryId)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.quickEmpty}>{i18n.t('noTemplates')}</Text>
                )}
              </View>
            ) : (
              <View style={styles.quickGrid}>
                {[
                  { categoryId: 'food', icon: 'shopping-cart' },
                  { categoryId: 'restaurant', icon: 'coffee' },
                  { categoryId: 'fuel', icon: 'droplet' },
                  { categoryId: 'transport', icon: 'navigation' },
                  { categoryId: 'household', icon: 'home' },
                  { categoryId: 'health', icon: 'heart' },
                  { categoryId: 'clothing', icon: 'shopping-bag' },
                  { categoryId: 'entertainment', icon: 'film' },
                ].map(tpl => {
                  const cfg = categoryConfig[tpl.categoryId] || categoryConfig.other;
                  return (
                    <TouchableOpacity key={tpl.categoryId} style={styles.quickBtn}
                      onPress={() => { setShowQuickSelect(false); setQuickTemplate(tpl); }} activeOpacity={0.7}>
                      <View style={[styles.quickIcon, { backgroundColor: cfg.color + '18' }]}>
                        <Feather name={cfg.icon} size={20} color={cfg.color} />
                      </View>
                      <Text style={styles.quickLabel} numberOfLines={1}>{i18n.t(tpl.categoryId)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* Global Modals */}
      <AddTransactionModal visible={showAdd} onClose={() => setShowAdd(false)} onSave={() => setShowAdd(false)} />
      <SmartInputModal visible={showSmartInput} onClose={() => setShowSmartInput(false)} onSave={() => setShowSmartInput(false)} />
      <AddRecurringModal visible={showRecurring} onClose={() => setShowRecurring(false)} onSave={() => setShowRecurring(false)} />
      <ReceiptScannerModal visible={showReceipt} onClose={() => setShowReceipt(false)} onSave={() => setShowReceipt(false)} />
      <QuickAddModal visible={!!quickTemplate} template={quickTemplate}
        onClose={() => setQuickTemplate(null)} onSaved={() => setQuickTemplate(null)} />
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  iconWrap: { width: 40, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 10, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
  addBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center', marginBottom: 20, shadowColor: colors.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },

  menuOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 },
  menuOverlayBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  menuContainer: { position: 'absolute', bottom: 120, left: 20, right: 20, backgroundColor: colors.card, borderRadius: 20, padding: 8, borderWidth: 1, borderColor: colors.cardBorder },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 14 },
  menuIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  menuText: { color: colors.text, fontSize: 16, fontWeight: '600', flex: 1 },

  quickSheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  quickTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 16 },
  quickTabs: { flexDirection: 'row', marginBottom: 16, backgroundColor: colors.bg, borderRadius: 12, padding: 3 },
  quickTabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  quickTabActive: { backgroundColor: colors.card },
  quickTabTxt: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  quickEmpty: { color: colors.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  quickBtn: { width: 76, alignItems: 'center', gap: 6, paddingVertical: 8 },
  quickIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  quickLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '600', textAlign: 'center' },
});
