// src/screens/DashboardScreen.js
// Графики: pie chart категорий, bar chart по месяцам, бюджеты с прогресс-барами
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Dimensions, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import AddRecurringModal from '../components/AddRecurringModal';
import AddTransactionModal from '../components/AddTransactionModal';
import BalanceCard from '../components/BalanceCard';
import BarChartCard from '../components/BarChartCard';
import BudgetModal from '../components/BudgetModal';
import BudgetsBlock from '../components/BudgetsBlock';
import ConfirmModal from '../components/ConfirmModal';
import DashboardLayoutModal, { DEFAULT_LAYOUT } from '../components/DashboardLayoutModal';
import FreeMoneyTodayBlock from '../components/FreeMoneyTodayBlock';
import GoalsBlock from '../components/GoalsBlock';
import PieChartCard from '../components/PieChartCard';
import RecentTxBlock from '../components/RecentTxBlock';
import RecurringBlock from '../components/RecurringBlock';
import QuickAddModal from '../components/QuickAddModal';
import ReceiptScannerModal from '../components/ReceiptScannerModal';
import SmartInputModal from '../components/SmartInputModal';
import RecurringDetailModal from '../components/RecurringDetailModal';
import StreakCard from '../components/StreakCard';
import i18n from '../i18n';
import dataService from '../services/dataService';
import streakService from '../services/streakService';
import { useToast } from '../components/ToastProvider';
import notificationService from '../services/notificationService';
import { categoryConfig, colors } from '../theme/colors';
import { sym } from '../utils/currency';

const SW = Dimensions.get('window').width;

export default function DashboardScreen() {
  const navigation = useNavigation();
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [editTx, setEditTx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [budgetModal, setBudgetModal] = useState(null);
  const [recurring, setRecurring] = useState([]);
  const [showRecurring, setShowRecurring] = useState(false);
  const [editRecurring, setEditRecurring] = useState(null);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [recDetail, setRecDetail] = useState(null);
  const [quickTemplate, setQuickTemplate] = useState(null);
  const [showQuickSelect, setShowQuickSelect] = useState(false);
  const [quickTab, setQuickTab] = useState('categories');
  const [quickTemplates, setQuickTemplates] = useState([]);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateCat, setNewTemplateCat] = useState('');
  const [newTemplateAcc, setNewTemplateAcc] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [deleteTemplate, setDeleteTemplate] = useState(null);
  const [showSmartInput, setShowSmartInput] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [streakData, setStreakData] = useState(null);
  const [newMilestone, setNewMilestone] = useState(null);
  const [weekStart, setWeekStart] = useState('sunday');
  const [notifications, setNotifications] = useState([]);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [dashLayout, setDashLayout] = useState(DEFAULT_LAYOUT);
  const [showLayoutModal, setShowLayoutModal] = useState(false);
  const [budgetsExpanded, setBudgetsExpanded] = useState(false);
  const [goalsExpanded, setGoalsExpanded] = useState(false);
  const [freeExpanded, setFreeExpanded] = useState(false);
  const [monthlyExtra, setMonthlyExtra] = useState(0);
  const [goals, setGoals] = useState([]);
  const [showAiHint, setShowAiHint] = useState(false);
  const bellAnim = useRef(new Animated.Value(1)).current;
  const aiGlow = useRef(new Animated.Value(0)).current;
  const toast = useToast();

  // Слушаем входящие уведомления
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(notification => {
      const { title, body } = notification.request.content;
      setNotifications(prev => [{ id: Date.now().toString(), title, body, time: new Date() }, ...prev].slice(0, 20));
      // Анимация колокольчика
      Animated.sequence([
        Animated.timing(bellAnim, { toValue: 1.3, duration: 150, useNativeDriver: true }),
        Animated.timing(bellAnim, { toValue: 0.9, duration: 100, useNativeDriver: true }),
        Animated.timing(bellAnim, { toValue: 1.1, duration: 100, useNativeDriver: true }),
        Animated.timing(bellAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
    });
    return () => sub.remove();
  }, []);

  const st = createSt();

  const loadData = async () => {
    // Wait for auth — don't load with zeros
    const uid = require('../services/authService').default.getUid();
    if (!uid) return;

    let [txs, bdg, rec, settings, accs, tpls, gls] = await Promise.all([
      dataService.getTransactions(),
      dataService.getBudgets(),
      dataService.getRecurring(),
      dataService.getSettings(),
      dataService.getAccounts(),
      dataService.getQuickTemplates(),
      dataService.getGoals(),
    ]);
    setGoals(gls);
    if (settings.weekStart) setWeekStart(settings.weekStart);
    let layout;
    if (settings.dashLayout) {
      // Merge saved layout with defaults (add new blocks that didn't exist before)
      const saved = settings.dashLayout;
      const savedIds = new Set(saved.map(b => b.id));
      layout = [...saved, ...DEFAULT_LAYOUT.filter(b => !savedIds.has(b.id))];
    } else {
      layout = DEFAULT_LAYOUT.map(b => ({ ...b }));
    }

    // Auto-reveal widgets based on user progress
    const revealed = new Set(settings.revealedWidgets || []);
    const txMonths = new Set(txs.map(tx => {
      const d = tx.date || tx.createdAt;
      return d ? d.substring(0, 7) : null;
    }).filter(Boolean));
    const streakResult = await streakService.updateStreaks(txs);

    const revealConditions = {
      streak: streakResult.streakData?.currentStreak >= 3,
      pieChart: txs.length >= 10,
      budgets: bdg.length > 0,
      recurring: rec.length > 0,
      goals: gls.length > 0,
      barChart: txMonths.size >= 2,
    };

    let hasNewReveal = false;
    for (const [widgetId, shouldReveal] of Object.entries(revealConditions)) {
      if (shouldReveal && !revealed.has(widgetId)) {
        const block = layout.find(b => b.id === widgetId);
        if (block && !block.visible) {
          block.visible = true;
          hasNewReveal = true;
        }
        revealed.add(widgetId);
      }
    }

    setDashLayout(layout);

    // Collect all settings changes and save once
    const settingsUpdates = {};
    if (hasNewReveal) {
      settingsUpdates.dashLayout = layout;
      settingsUpdates.revealedWidgets = [...revealed];
    } else if (revealed.size > (settings.revealedWidgets || []).length) {
      settingsUpdates.revealedWidgets = [...revealed];
    }

    // Show AI hint on first launch
    if (!settings.aiHintShown) {
      setShowAiHint(true);
      Animated.loop(
        Animated.sequence([
          Animated.timing(aiGlow, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(aiGlow, { toValue: 0, duration: 800, useNativeDriver: true }),
        ]),
        { iterations: 4 }
      ).start();
      settingsUpdates.aiHintShown = true;
    }

    // Save all changes at once to avoid race conditions
    if (Object.keys(settingsUpdates).length > 0) {
      await dataService.saveSettings({ ...settings, ...settingsUpdates });
    }

    setMonthlyExtra(settings.monthlyExtra || 0);

    // Auto-confirm recurring payments that are due
    const todayStr = new Date().toISOString().slice(0, 10);
    let recUpdated = false;
    for (const r of rec) {
      if (r.isActive && r.autoConfirm && r.nextDate && r.nextDate <= todayStr) {
        await dataService.confirmRecurring(r.id);
        recUpdated = true;
      }
    }
    if (recUpdated) {
      txs = await dataService.getTransactions();
      rec = await dataService.getRecurring();
    }

    setTransactions(txs);
    setBudgets(bdg);
    setAccounts(accs.filter(a => a.isActive !== false));
    setQuickTemplates(tpls);
    setRecurring(rec);

    // Обновляем стрики (уже посчитано выше)
    setStreakData(streakResult.streakData);
    if (streakResult.newMilestone) setNewMilestone(streakResult.newMilestone);
    if (txs.length > 0 || accs.length > 0) setLoading(false);
  };

  useFocusEffect(useCallback(() => {
    loadData();
    // Retry after auth may have restored session
    const timer = setTimeout(() => {
      loadData().then(() => setLoading(false));
    }, 2000);
    return () => clearTimeout(timer);
  }, []));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadData();
    });
    return () => sub.remove();
  }, []);
  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const lang = i18n.getLanguage();
  const now = new Date();
  const monthNames = {
    ru: ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'],
    he: ['ינו','פבר','מרץ','אפר','מאי','יונ','יול','אוג','ספט','אוק','נוב','דצמ'],
    en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  };
  const fullMonths = {
    ru: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
    he: ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'],
    en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  };
  const mNames = monthNames[lang] || monthNames.en;
  const dateStr = `${(fullMonths[lang] || fullMonths.en)[now.getMonth()]} ${now.getFullYear()}`;

  const thisMonth = transactions.filter(t => {
    const d = new Date(t.date || t.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const totalIncome = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;
  const recentTx = [...transactions].sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || '')).slice(0, 3);

  // PIE CHART
  const catTotals = {};
  thisMonth.filter(t => t.type === 'expense').forEach(t => {
    const cat = t.categoryId || 'other';
    catTotals[cat] = (catTotals[cat] || 0) + t.amount;
  });
  // Build category name lookup from transactions
  const catNameMap = {};
  thisMonth.forEach(t => { if (t.categoryName) catNameMap[t.categoryId] = t.categoryName; });

  const pieData = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([cat, amount]) => ({
      name: catNameMap[cat] || i18n.t(cat),
      amount,
      color: categoryConfig[cat]?.color || '#64748b',
      legendFontColor: colors.textDim,
      legendFontSize: 11,
    }));

  // BAR CHART
  const barData = [];
  for (let i = 5; i >= 0; i--) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mTxs = transactions.filter(t => {
      const d = new Date(t.date || t.createdAt);
      return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();
    });
    const inc = mTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = mTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    barData.push({ month: (fullMonths[lang] || fullMonths.en)[m.getMonth()], income: inc, expense: exp });
  }
  const maxBar = Math.max(...barData.map(d => Math.max(d.income, d.expense)), 1);

  // BUDGET DATA
  const budgetRows = [];
  Object.entries(budgets).forEach(([cat, limit]) => {
    const spent = catTotals[cat] || 0;
    budgetRows.push({ cat, spent, limit, hasBudget: true });
  });
  const remaining = 6 - budgetRows.length;
  if (remaining > 0) {
    Object.entries(catTotals)
      .filter(([cat]) => !budgets[cat])
      .sort((a, b) => b[1] - a[1])
      .slice(0, remaining)
      .forEach(([cat, spent]) => {
        budgetRows.push({ cat, spent, limit: 0, hasBudget: false });
      });
  }
  budgetRows.sort((a, b) => {
    if (a.hasBudget && !b.hasBudget) return -1;
    if (!a.hasBudget && b.hasBudget) return 1;
    return b.spent - a.spent;
  });

  const totalBudgetLimit = Object.values(budgets).reduce((s, v) => s + v, 0);
  const totalBudgetSpent = Object.keys(budgets).reduce((s, cat) => s + (catTotals[cat] || 0), 0);
  const totalBudgetPct = totalBudgetLimit > 0 ? Math.round((totalBudgetSpent / totalBudgetLimit) * 100) : 0;
  const hasBudgets = Object.keys(budgets).length > 0;

  // HANDLERS
  const handleDelete = async () => {
    if (deleteTarget) {
      const ok = await dataService.deleteTransaction(deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
      toast.show(ok ? i18n.t('deleted') : i18n.t('errorOccurred'), ok ? 'success' : 'error');
    }
  };
  const handleDuplicate = async (tx) => {
    const res = await dataService.addTransaction({ ...tx, id: undefined, createdAt: undefined, date: new Date().toISOString(), note: tx.note ? `${tx.note} (copy)` : '(copy)' });
    await loadData();
    toast.show(res ? i18n.t('duplicated') : i18n.t('errorOccurred'), res ? 'success' : 'error');
  };
  const handleCloseModal = () => { setShowAdd(false); setEditTx(null); };
  const handleBudgetSave = async (categoryId, limit) => {
    await dataService.setBudget(categoryId, limit);
    await loadData();
    toast.show(i18n.t('saved'), 'success');
  };
  const handleBudgetDelete = async (categoryId) => { await dataService.deleteBudget(categoryId); await loadData(); };
  const handleConfirmRecurring = async (id) => {
    await dataService.confirmRecurring(id);
    await loadData();
    notificationService.scheduleRecurringNotifications();
    toast.show(i18n.t('paymentConfirmed'), 'success');
  };
  const handleSkipRecurring = async (id) => {
    await dataService.skipRecurring(id);
    await loadData();
    notificationService.scheduleRecurringNotifications();
    toast.show(i18n.t('paymentSkipped'), 'info');
  };
  const handleDeleteRecurring = async (id) => {
    await dataService.deleteRecurring(id);
    await loadData();
    notificationService.scheduleRecurringNotifications();
    toast.show(i18n.t('deleted'), 'success');
  };

  const handleLayoutSave = async (newLayout) => {
    setDashLayout(newLayout);
    const settings = await dataService.getSettings();
    await dataService.saveSettings({ ...settings, dashLayout: newLayout });
  };

  const isBlockVisible = (id) => {
    const block = dashLayout.find(b => b.id === id);
    return block ? block.visible : true;
  };

  // Предстоящие платежи (ближайшие 30 дней, активные)
  const today = new Date();
  const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
  const upcoming = recurring
    .filter(r => r.isActive && r.nextDate)
    .filter(r => new Date(r.nextDate) <= in30)
    .sort((a, b) => new Date(a.nextDate) - new Date(b.nextDate));

  if (loading) {
    return (
      <View style={[st.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Image source={require('../../assets/images/icon.png')} style={{ width: 64, height: 64, borderRadius: 16, marginBottom: 16 }} />
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>{i18n.t('loading')}</Text>
      </View>
    );
  }

  return (
    <View style={st.container}>
      <ScrollView showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
        contentContainerStyle={{ paddingBottom: 120 }}>

        <View style={st.header}>
          <TouchableOpacity style={{ flexShrink: 1, minWidth: 0 }} onPress={() => { setShowAiHint(false); navigation.navigate('AIChat'); }} activeOpacity={0.7}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={st.logo}>Q<Animated.Text style={{ color: colors.green, opacity: showAiHint ? aiGlow.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] }) : 1 }}>ai</Animated.Text>zo</Text>
            </View>
            <Text style={st.subtitle}>{dateStr}</Text>
            {showAiHint && (
              <View style={st.aiHint}>
                <Text style={st.aiHintText} numberOfLines={2}>{i18n.t('aiHint')}</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8, flexShrink: 0 }}>
          <TouchableOpacity style={st.profileBtn} onPress={() => setShowLayoutModal(true)}>
            <Feather name="sliders" size={18} color={colors.textDim} />
          </TouchableOpacity>
          <TouchableOpacity style={st.profileBtn} onPress={() => setShowNotifModal(true)}>
            <Animated.View style={{ transform: [{ scale: bellAnim }] }}>
              <Feather name="bell" size={20} color={notifications.length > 0 ? colors.green : colors.textDim} />
            </Animated.View>
            {notifications.length > 0 && (
              <View style={st.bellBadge}>
                <Text style={st.bellBadgeText}>{notifications.length > 9 ? '9+' : notifications.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={st.profileBtn} onPress={() => navigation.navigate('Settings')}>
            <Feather name="menu" size={20} color={colors.textDim} />
          </TouchableOpacity>
          </View>
        </View>

        {dashLayout.map(block => {
          if (!block.visible) return null;
          switch (block.id) {
            case 'balance':
              return (
                <BalanceCard
                  key="balance"
                  balance={balance}
                  totalIncome={totalIncome}
                  totalExpense={totalExpense}
                  now={now}
                />
              );
            case 'streak':
              return <StreakCard key="streak" streakData={streakData} transactions={transactions} weekStart={weekStart} />;
            case 'freeMoneyToday':
              return (
                <FreeMoneyTodayBlock
                  key="freeMoneyToday"
                  now={now}
                  totalIncome={totalIncome}
                  recurring={recurring}
                  transactions={transactions}
                  thisMonth={thisMonth}
                  monthlyExtra={monthlyExtra}
                  expanded={freeExpanded}
                  onToggle={() => setFreeExpanded(!freeExpanded)}
                  onAddRecurring={() => setShowRecurring(true)}
                />
              );
            case 'pieChart':
              return <PieChartCard key="pieChart" pieData={pieData} />;
            case 'budgets':
              return (
                <BudgetsBlock
                  key="budgets"
                  budgetRows={budgetRows}
                  hasBudgets={hasBudgets}
                  totalBudgetSpent={totalBudgetSpent}
                  totalBudgetLimit={totalBudgetLimit}
                  totalBudgetPct={totalBudgetPct}
                  catNameMap={catNameMap}
                  expanded={budgetsExpanded}
                  onToggle={() => setBudgetsExpanded(!budgetsExpanded)}
                  onBudgetPress={setBudgetModal}
                />
              );
            case 'recurring':
              return (
                <RecurringBlock
                  key="recurring"
                  recurring={recurring}
                  upcoming={upcoming}
                  today={today}
                  onAdd={() => setShowRecurring(true)}
                  onEdit={(rec) => setEditRecurring(rec)}
                  onDelete={handleDeleteRecurring}
                  onSkip={handleSkipRecurring}
                  onConfirm={handleConfirmRecurring}
                  onDetail={(rec) => setRecDetail(rec)}
                />
              );
            case 'barChart':
              return <BarChartCard key="barChart" barData={barData} maxBar={maxBar} />;
            case 'goals':
              return (
                <GoalsBlock
                  key="goals"
                  goals={goals}
                  expanded={goalsExpanded}
                  onToggle={() => setGoalsExpanded(!goalsExpanded)}
                />
              );
            case 'recentTx':
              return (
                <RecentTxBlock
                  key="recentTx"
                  recentTx={recentTx}
                  onDelete={t => setDeleteTarget(t)}
                  onEdit={t => setEditTx(t)}
                  onDuplicate={handleDuplicate}
                />
              );
            default: return null;
          }
        })}
      </ScrollView>

      <AddTransactionModal visible={showAdd || !!editTx} onClose={handleCloseModal} onSave={() => loadData()} editTransaction={editTx} />
      <ConfirmModal visible={!!deleteTarget} title={i18n.t('delete')}
        message={deleteTarget ? `${deleteTarget.categoryName || i18n.t(deleteTarget.categoryId)} — ${deleteTarget.amount} ${sym()}` : ''}
        confirmText={i18n.t('delete')} cancelText={i18n.t('cancel')}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      <ConfirmModal visible={deleteTemplate !== null} title={i18n.t('delete')}
        message={deleteTemplate !== null && quickTemplates[deleteTemplate] ? (quickTemplates[deleteTemplate].name || i18n.t(quickTemplates[deleteTemplate].categoryId)) : ''}
        confirmText={i18n.t('delete')} cancelText={i18n.t('cancel')}
        onConfirm={() => {
          const updated = quickTemplates.filter((_, i) => i !== deleteTemplate);
          setQuickTemplates(updated);
          dataService.saveQuickTemplates(updated);
          setDeleteTemplate(null);
        }} onCancel={() => setDeleteTemplate(null)} />
      <BudgetModal visible={!!budgetModal} categoryId={budgetModal?.categoryId}
        currentLimit={budgetModal ? (budgets[budgetModal.categoryId] || 0) : 0}
        spent={budgetModal?.spent || 0}
        onSave={handleBudgetSave} onDelete={handleBudgetDelete} onClose={() => setBudgetModal(null)} />
      <AddRecurringModal visible={showRecurring || !!editRecurring}
        onClose={() => { setShowRecurring(false); setEditRecurring(null); }}
        onSave={() => loadData()} editItem={editRecurring} />
      <RecurringDetailModal visible={!!recDetail} item={recDetail}
        onClose={() => setRecDetail(null)}
        onConfirm={(id) => { handleConfirmRecurring(id); setRecDetail(null); }}
        onSkip={(id) => { handleSkipRecurring(id); setRecDetail(null); }}
        onDelete={(id) => { handleDeleteRecurring(id); setRecDetail(null); }}
        onEdit={(item) => { setRecDetail(null); setEditRecurring(item); }} />
      {/* Quick category select */}
      {showQuickSelect && (
        <TouchableOpacity style={st.fabOverlay} activeOpacity={1} onPress={() => setShowQuickSelect(false)}>
          <View style={st.quickSelectSheet}>
            <Text style={st.quickSelectTitle}>{i18n.t('quickAdd')}</Text>

            {/* Tabs: Templates / Categories */}
            <View style={st.quickTabs}>
              <TouchableOpacity style={[st.quickTab, quickTab === 'templates' && st.quickTabActive]} onPress={() => setQuickTab('templates')}>
                <Feather name="bookmark" size={14} color={quickTab === 'templates' ? colors.green : colors.textMuted} />
                <Text style={[st.quickTabTxt, quickTab === 'templates' && { color: colors.green }]}>{i18n.t('templates')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.quickTab, quickTab === 'categories' && st.quickTabActive]} onPress={() => setQuickTab('categories')}>
                <Feather name="grid" size={14} color={quickTab === 'categories' ? colors.green : colors.textMuted} />
                <Text style={[st.quickTabTxt, quickTab === 'categories' && { color: colors.green }]}>{i18n.t('categories')}</Text>
              </TouchableOpacity>
            </View>

            {quickTab === 'templates' ? (
              <View>
                {quickTemplates.length > 0 ? (
                  <View style={st.quickSelectGrid}>
                    {quickTemplates.map((tpl, idx) => {
                      const cfg = categoryConfig[tpl.categoryId] || categoryConfig.other;
                      return (
                        <TouchableOpacity key={idx} style={st.quickBtn}
                          onPress={() => { setShowQuickSelect(false); setQuickTemplate(tpl); }}
                          onLongPress={() => setDeleteTemplate(idx)}
                          activeOpacity={0.7}>
                          <View style={[st.quickIcon, { backgroundColor: cfg.color + '18' }]}>
                            <Feather name={cfg.icon} size={20} color={cfg.color} />
                          </View>
                          <Text style={st.quickLabel} numberOfLines={1}>{tpl.name || i18n.t(tpl.categoryId)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={st.quickEmptyTxt}>{i18n.t('noTemplates')}</Text>
                )}
                <TouchableOpacity style={st.addTemplateBtn} onPress={() => { setShowQuickSelect(false); setShowAddTemplate(true); }}>
                  <Feather name="plus" size={16} color={colors.green} />
                  <Text style={st.addTemplateTxt}>{i18n.t('addTemplate')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={st.quickSelectGrid}>
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
                    <TouchableOpacity key={tpl.categoryId} style={st.quickBtn}
                      onPress={() => { setShowQuickSelect(false); setQuickTemplate(tpl); }} activeOpacity={0.7}>
                      <View style={[st.quickIcon, { backgroundColor: cfg.color + '18' }]}>
                        <Feather name={cfg.icon} size={20} color={cfg.color} />
                      </View>
                      <Text style={st.quickLabel} numberOfLines={1}>{i18n.t(tpl.categoryId)}</Text>
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
        <TouchableOpacity style={st.fabOverlay} activeOpacity={1} onPress={() => setShowAddTemplate(false)}>
          <TouchableOpacity style={st.quickSelectSheet} activeOpacity={1}>
            <Text style={st.quickSelectTitle}>{i18n.t('addTemplate')}</Text>
            <TextInput style={st.templateInput} value={newTemplateName} onChangeText={setNewTemplateName}
              placeholder={i18n.t('templateName')} placeholderTextColor={colors.textMuted} />
            <Text style={st.templateLabel}>{i18n.t('category')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {Object.keys(categoryConfig).filter(k => !['transfer','salary_me','salary_spouse','rental_income','handyman','sales','other_income'].includes(k)).map(cid => {
                const cfg = categoryConfig[cid];
                const sel = newTemplateCat === cid;
                return (
                  <TouchableOpacity key={cid} style={[st.templateChip, sel && { borderColor: cfg.color, backgroundColor: `${cfg.color}15` }]}
                    onPress={() => setNewTemplateCat(cid)}>
                    <Feather name={cfg.icon} size={14} color={sel ? cfg.color : colors.textMuted} />
                    <Text style={[st.templateChipTxt, sel && { color: cfg.color }]} numberOfLines={1}>{i18n.t(cid)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Text style={st.templateLabel}>{i18n.t('account')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {accounts.filter(a => ['cash','bank','credit'].includes(a.type)).map(acc => {
                const sel = newTemplateAcc === acc.id;
                return (
                  <TouchableOpacity key={acc.id} style={[st.templateChip, sel && { borderColor: colors.teal, backgroundColor: `${colors.teal}15` }]}
                    onPress={() => setNewTemplateAcc(acc.id)}>
                    <Text style={[st.templateChipTxt, sel && { color: colors.teal }]} numberOfLines={1}>{acc.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={{ flexDirection: i18n.row(), gap: 12 }}>
              <TouchableOpacity style={st.templateCancelBtn} onPress={() => setShowAddTemplate(false)}>
                <Text style={{ color: colors.textDim, fontWeight: '600' }}>{i18n.t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.templateSaveBtn} onPress={() => {
                if (!newTemplateCat) return;
                const customName = newTemplateName.trim();
                // Don't save name if it matches category translation (would break on language switch)
                const catName = i18n.t(newTemplateCat);
                const tpl = { name: customName && customName !== catName ? customName : '', categoryId: newTemplateCat, account: newTemplateAcc || null };
                const updated = [...quickTemplates, tpl];
                setQuickTemplates(updated);
                dataService.saveQuickTemplates(updated);
                setShowAddTemplate(false);
                setNewTemplateName('');
                setNewTemplateCat('');
                setNewTemplateAcc('');
              }}>
                <Feather name="check" size={16} color={colors.bg} />
                <Text style={{ color: colors.bg, fontWeight: '700' }}>{i18n.t('save')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      )}
      <QuickAddModal visible={!!quickTemplate} template={quickTemplate}
        onClose={() => setQuickTemplate(null)} onSaved={() => loadData()} />
      <SmartInputModal visible={showSmartInput}
        onClose={() => setShowSmartInput(false)} onSaved={() => loadData()} />
      <ReceiptScannerModal visible={showReceipt}
        onClose={() => setShowReceipt(false)} onSaved={() => loadData()} />

      {/* Notifications modal */}
      <Modal visible={showNotifModal} transparent animationType="fade" onRequestClose={() => setShowNotifModal(false)}>
        <TouchableOpacity style={st.notifOverlay} activeOpacity={1} onPress={() => setShowNotifModal(false)}>
          <View style={st.notifModal}>
            <View style={st.notifHeader}>
              <Feather name="bell" size={20} color={colors.green} />
              <Text style={st.notifTitle}>{i18n.t('notifications')}</Text>
              {notifications.length > 0 && (
                <TouchableOpacity onPress={() => { setNotifications([]); }} style={st.notifClearBtn}>
                  <Text style={st.notifClearTxt}>{i18n.t('clearAll')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {notifications.length === 0 ? (
              <View style={st.notifEmpty}>
                <Feather name="bell-off" size={32} color={colors.textMuted} />
                <Text style={st.notifEmptyTxt}>{i18n.t('noNotifications')}</Text>
              </View>
            ) : (
              <ScrollView style={st.notifList} showsVerticalScrollIndicator={false}>
                {notifications.map((n) => (
                  <View key={n.id} style={st.notifItem}>
                    <View style={st.notifDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={st.notifItemTitle}>{n.title}</Text>
                      <Text style={st.notifItemBody}>{n.body}</Text>
                      <Text style={st.notifItemTime}>
                        {n.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Milestone celebration */}
      {newMilestone && (
        <TouchableOpacity style={st.milestoneOverlay} activeOpacity={1} onPress={() => setNewMilestone(null)}>
          <View style={st.milestoneCard}>
            <Text style={st.milestoneEmoji}>🔥</Text>
            <Text style={st.milestoneTxt}>{i18n.t(`streakMilestone${newMilestone}`)}</Text>
            <TouchableOpacity style={st.milestoneBtn} onPress={() => setNewMilestone(null)}>
              <Text style={st.milestoneBtnTxt}>OK</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      <DashboardLayoutModal
        visible={showLayoutModal}
        onClose={() => setShowLayoutModal(false)}
        layout={dashLayout}
        onSave={handleLayoutSave}
      />
    </View>
  );
}

const createSt = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 24 },
  logoImg: { width: 38, height: 38, borderRadius: 10 },
  logo: { color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -1 },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  aiHint: { backgroundColor: colors.green, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginTop: 6 },
  aiHintText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  profileBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 36 },
  emptyText: { color: colors.textMuted, fontSize: 14, fontWeight: '600', marginTop: 12 },
  fab: { position: 'absolute', right: 24, bottom: 100, width: 60, height: 60, borderRadius: 18, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center', shadowColor: colors.green, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10, zIndex: 10 },
  fabOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 5 },
  fabMenu: { position: 'absolute', right: 24, bottom: 170, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.cardBorder, overflow: 'hidden', minWidth: 200 },
  fabMenuItem: { flexDirection: i18n.row(), alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, gap: 12 },
  fabMenuTxt: { color: colors.text, fontSize: 14, fontWeight: '600' },
  fabMenuDivider: { height: 1, backgroundColor: colors.divider },

  // Quick select sheet
  quickSelectSheet: { position: 'absolute', right: 24, left: 24, bottom: 170, backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.cardBorder, padding: 20 },
  quickSelectTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  quickTabs: { flexDirection: i18n.row(), marginBottom: 16, backgroundColor: colors.bg, borderRadius: 12, padding: 3 },
  quickTab: { flex: 1, flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  quickTabActive: { backgroundColor: colors.card },
  quickTabTxt: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  quickEmptyTxt: { color: colors.textMuted, fontSize: 12, textAlign: 'center', paddingVertical: 20 },
  addTemplateBtn: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, marginTop: 8 },
  addTemplateTxt: { color: colors.green, fontSize: 12, fontWeight: '600' },
  templateInput: { backgroundColor: colors.bg, borderRadius: 12, padding: 14, color: colors.text, fontSize: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.cardBorder, textAlign: i18n.textAlign() },
  templateLabel: { color: colors.textDim, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6, textAlign: i18n.textAlign() },
  templateChip: { flexDirection: i18n.row(), alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.bg, marginEnd: 6, borderWidth: 1.5, borderColor: 'transparent', gap: 4 },
  templateChipTxt: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  templateCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, alignItems: 'center' },
  templateSaveBtn: { flex: 1, flexDirection: i18n.row(), paddingVertical: 14, borderRadius: 12, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', gap: 6 },
  quickSelectGrid: { flexDirection: i18n.row(), flexWrap: 'wrap', justifyContent: 'center', gap: 8 },

  // Quick templates
  quickBtn: { alignItems: 'center', width: 68, paddingVertical: 8 },
  quickIcon: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  quickLabel: { color: colors.textDim, fontSize: 12, fontWeight: '600', textAlign: 'center' },

  // Bell badge
  bellBadge: { position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.red, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  bellBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  // Notifications modal
  notifOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-start', paddingTop: 110, alignItems: 'center' },
  notifModal: { backgroundColor: colors.bg2, borderRadius: 24, marginHorizontal: 20, width: SW - 40, maxHeight: 420, borderWidth: 1, borderColor: colors.cardBorder, overflow: 'hidden' },
  notifHeader: { flexDirection: i18n.row(), alignItems: 'center', gap: 10, padding: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.divider },
  notifTitle: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 },
  notifClearBtn: { paddingVertical: 4, paddingHorizontal: 10 },
  notifClearTxt: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  notifEmpty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  notifEmptyTxt: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  notifList: { maxHeight: 340, paddingHorizontal: 20 },
  notifItem: { flexDirection: i18n.row(), alignItems: 'flex-start', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 12 },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green, marginTop: 6 },
  notifItemTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  notifItemBody: { color: colors.textDim, fontSize: 12, lineHeight: 18 },
  notifItemTime: { color: colors.textMuted, fontSize: 12, marginTop: 4 },

  // Milestone celebration
  milestoneOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 20 },
  milestoneCard: { backgroundColor: colors.card, borderRadius: 24, padding: 32, alignItems: 'center', marginHorizontal: 40, borderWidth: 2, borderColor: colors.orange },
  milestoneEmoji: { fontSize: 48, marginBottom: 16 },
  milestoneTxt: { color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  milestoneBtn: { backgroundColor: colors.orange, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 },
  milestoneBtnTxt: { color: colors.bg, fontSize: 16, fontWeight: '700' },
});