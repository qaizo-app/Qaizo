// src/navigation/AppNavigator.js
import { Feather } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import i18n from '../i18n';
import { useToast } from '../components/ToastProvider';
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
import AnalyticsScreen from '../screens/AnalyticsScreen';
import ShoppingListScreen from '../screens/ShoppingListScreen';
import GoalsScreen from '../screens/GoalsScreen';
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
      <DashboardStack.Screen name="Goals" component={GoalsScreen} />
      <DashboardStack.Screen name="Analytics" component={AnalyticsScreen} />
      <DashboardStack.Screen name="ShoppingList" component={ShoppingListScreen} />
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
  { key: 'oneTimePayment',  icon: 'plus-circle', color: colors.green },
  { key: 'recurringPayment', icon: 'repeat',   color: '#60a5fa' },
  { key: 'quickAdd',        icon: 'zap',       color: '#f59e0b' },
  { key: 'scanReceipt',     icon: 'camera',    color: colors.teal },
];

export default function AppNavigator({ pendingAction, onPendingActionHandled }) {
  const [, setLangVer] = useState(0);
  useEffect(() => i18n.onLanguageChange(() => setLangVer(v => v + 1)), []);
  const insets = useSafeAreaInsets();
  const tabBarHeight = 60 + Math.max(insets.bottom, 16);
  const styles = createStyles();
  const toast = useToast();

  // Add menu state
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addInitialType, setAddInitialType] = useState('expense');

  useEffect(() => {
    if (!pendingAction) return;
    if (pendingAction === 'add_income') { setAddInitialType('income'); setShowAdd(true); }
    else if (pendingAction === 'add_expense') { setAddInitialType('expense'); setShowAdd(true); }
    onPendingActionHandled?.();
  }, [pendingAction]);
  const [showSmartInput, setShowSmartInput] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showQuickSelect, setShowQuickSelect] = useState(false);
  const [quickTemplate, setQuickTemplate] = useState(null);
  const [quickTemplates, setQuickTemplates] = useState([]);
  const [quickTab, setQuickTab] = useState('categories');
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateCat, setNewTemplateCat] = useState('');
  const [newTemplateAcc, setNewTemplateAcc] = useState('');
  const [accounts, setAccounts] = useState([]);
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
      if (key === 'smartInput') toast.show(i18n.t('comingSoonMessage'), 'info');
      else if (key === 'scanReceipt') setShowReceipt(true);
      else if (key === 'oneTimePayment') setShowAdd(true);
      else if (key === 'recurringPayment') setShowRecurring(true);
      else if (key === 'quickAdd') {
        Promise.all([dataService.getQuickTemplates(), dataService.getAccounts()]).then(([t, a]) => {
          setQuickTemplates(t);
          setAccounts(a.filter(acc => acc.isActive !== false));
        });
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
                {item.comingSoon && <Text style={styles.comingSoonBadge}>{i18n.t('comingSoon')}</Text>}
              </TouchableOpacity>
            ))}
          </Animated.View>
        </Animated.View>
      )}

      {/* Quick Select Overlay — exact copy from Dashboard */}
      {showQuickSelect && (
        <TouchableOpacity style={styles.fabOverlay} activeOpacity={1} onPress={() => setShowQuickSelect(false)}>
          <View style={styles.quickSelectSheet}>
            <Text style={styles.quickSelectTitle}>{i18n.t('quickAdd')}</Text>

            <View style={styles.quickTabs}>
              <TouchableOpacity style={[styles.quickTabBtn, quickTab === 'templates' && styles.quickTabActive]} onPress={() => setQuickTab('templates')}>
                <Feather name="bookmark" size={14} color={quickTab === 'templates' ? colors.green : colors.textMuted} />
                <Text style={[styles.quickTabTxt, quickTab === 'templates' && { color: colors.green }]}>{i18n.t('templates')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.quickTabBtn, quickTab === 'categories' && styles.quickTabActive]} onPress={() => setQuickTab('categories')}>
                <Feather name="grid" size={14} color={quickTab === 'categories' ? colors.green : colors.textMuted} />
                <Text style={[styles.quickTabTxt, quickTab === 'categories' && { color: colors.green }]}>{i18n.t('categories')}</Text>
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
                <TouchableOpacity style={styles.addTemplateBtn} onPress={() => { setShowQuickSelect(false); setShowAddTemplate(true); }}>
                  <Feather name="plus" size={16} color={colors.green} />
                  <Text style={styles.addTemplateTxt}>{i18n.t('addTemplate')}</Text>
                </TouchableOpacity>
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
          </View>
        </TouchableOpacity>
      )}

      {/* Add Template Modal */}
      {showAddTemplate && (
        <TouchableOpacity style={styles.fabOverlay} activeOpacity={1} onPress={() => setShowAddTemplate(false)}>
          <TouchableOpacity style={styles.quickSelectSheet} activeOpacity={1}>
            <Text style={styles.quickSelectTitle}>{i18n.t('addTemplate')}</Text>
            <TextInput style={styles.templateInput} value={newTemplateName} onChangeText={setNewTemplateName}
              placeholder={i18n.t('templateName')} placeholderTextColor={colors.textMuted} />
            <Text style={styles.templateLabel}>{i18n.t('category')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {Object.keys(categoryConfig).filter(k => !['transfer','salary_me','salary_spouse','rental_income','handyman','sales','other_income','insurance','pension','investment','mortgage','education','childcare','arnona','vaad'].includes(k)).map(cid => {
                const cfg = categoryConfig[cid];
                const sel = newTemplateCat === cid;
                return (
                  <TouchableOpacity key={cid} style={[styles.templateChip, sel && { borderColor: cfg.color, backgroundColor: `${cfg.color}15` }]}
                    onPress={() => setNewTemplateCat(cid)}>
                    <Feather name={cfg.icon} size={14} color={sel ? cfg.color : colors.textMuted} />
                    <Text style={[styles.templateChipTxt, sel && { color: cfg.color }]} numberOfLines={1}>{i18n.t(cid)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Text style={styles.templateLabel}>{i18n.t('account')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {accounts.filter(a => ['cash','bank','credit'].includes(a.type)).map(acc => {
                const sel = newTemplateAcc === acc.id;
                return (
                  <TouchableOpacity key={acc.id} style={[styles.templateChip, sel && { borderColor: colors.teal, backgroundColor: `${colors.teal}15` }]}
                    onPress={() => setNewTemplateAcc(acc.id)}>
                    <Text style={[styles.templateChipTxt, sel && { color: colors.teal }]} numberOfLines={1}>{acc.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={styles.templateCancelBtn} onPress={() => setShowAddTemplate(false)}>
                <Text style={{ color: colors.textDim, fontWeight: '600' }}>{i18n.t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.templateSaveBtn} onPress={() => {
                if (!newTemplateCat) return;
                const customName = newTemplateName.trim();
                const catName = i18n.t(newTemplateCat);
                const tpl = { name: customName && customName !== catName ? customName : '', categoryId: newTemplateCat, account: newTemplateAcc || null };
                const updated = [...quickTemplates, tpl];
                setQuickTemplates(updated);
                dataService.saveQuickTemplates(updated);
                setShowAddTemplate(false);
                setNewTemplateName(''); setNewTemplateCat(''); setNewTemplateAcc('');
              }}>
                <Feather name="check" size={16} color={colors.bg} />
                <Text style={{ color: colors.bg, fontWeight: '700' }}>{i18n.t('save')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* Global Modals */}
      <AddTransactionModal visible={showAdd} onClose={() => setShowAdd(false)} onSave={() => setShowAdd(false)} initialType={addInitialType} />
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
  addBtn: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center', marginBottom: 20, shadowColor: colors.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },

  menuOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 },
  menuOverlayBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  menuContainer: { position: 'absolute', bottom: 120, left: 20, right: 20, backgroundColor: colors.card, borderRadius: 20, padding: 8, borderWidth: 1, borderColor: colors.cardBorder },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 14 },
  menuIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  menuText: { color: colors.text, fontSize: 16, fontWeight: '600', flex: 1 },
  comingSoonBadge: { color: colors.textMuted, fontSize: 10, fontWeight: '600', backgroundColor: colors.bg2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },

  fabOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100 },
  quickSelectSheet: { position: 'absolute', right: 24, left: 24, bottom: 170, backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.cardBorder, padding: 20 },
  quickSelectTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  quickTabs: { flexDirection: 'row', marginBottom: 16, backgroundColor: colors.bg, borderRadius: 12, padding: 3 },
  quickTabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  quickTabActive: { backgroundColor: colors.card },
  quickTabTxt: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  quickEmpty: { color: colors.textMuted, fontSize: 12, textAlign: 'center', paddingVertical: 20 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  quickBtn: { width: 68, alignItems: 'center', gap: 6, paddingVertical: 8 },
  quickIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  quickLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  addTemplateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, marginTop: 8 },
  addTemplateTxt: { color: colors.green, fontSize: 12, fontWeight: '600' },
  templateInput: { backgroundColor: colors.bg, borderRadius: 12, padding: 14, color: colors.text, fontSize: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.cardBorder },
  templateLabel: { color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  templateChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.bg, marginEnd: 6, borderWidth: 1.5, borderColor: 'transparent', gap: 4 },
  templateChipTxt: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  templateCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, alignItems: 'center' },
  templateSaveBtn: { flex: 1, flexDirection: 'row', paddingVertical: 14, borderRadius: 12, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', gap: 6 },
});
