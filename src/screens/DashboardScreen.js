// src/screens/DashboardScreen.js
// Графики: pie chart категорий, bar chart по месяцам, бюджеты с прогресс-барами
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import AddRecurringModal from '../components/AddRecurringModal';
import AddTransactionModal from '../components/AddTransactionModal';
import BudgetModal from '../components/BudgetModal';
import Card from '../components/Card';
import ConfirmModal from '../components/ConfirmModal';
import DashboardLayoutModal, { DEFAULT_LAYOUT } from '../components/DashboardLayoutModal';
import InteractivePieChart from '../components/InteractivePieChart';
import InteractiveBarChart from '../components/InteractiveBarChart';
import QuickAddModal from '../components/QuickAddModal';
import ReceiptScannerModal from '../components/ReceiptScannerModal';
import SmartInputModal from '../components/SmartInputModal';
import RecurringDetailModal from '../components/RecurringDetailModal';
import StreakCard from '../components/StreakCard';
import TransactionItem from '../components/TransactionItem';
import i18n from '../i18n';
import dataService from '../services/dataService';
import streakService from '../services/streakService';
import { useToast } from '../components/ToastProvider';
import notificationService from '../services/notificationService';
import Amount from '../components/Amount';
import { categoryConfig, colors } from '../theme/colors';
import { sym } from '../utils/currency';

const SW = Dimensions.get('window').width;

export default function DashboardScreen() {
  const navigation = useNavigation();
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [editTx, setEditTx] = useState(null);
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
  const [monthlyExtra, setMonthlyExtra] = useState(0);
  const [goals, setGoals] = useState([]);
  const bellAnim = useRef(new Animated.Value(1)).current;
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
    const [txs, bdg, rec, settings, accs, tpls, gls] = await Promise.all([
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
    if (settings.dashLayout) setDashLayout(settings.dashLayout);
    setMonthlyExtra(settings.monthlyExtra || 0);
    setTransactions(txs);
    setBudgets(bdg);
    setAccounts(accs.filter(a => a.isActive !== false));
    setQuickTemplates(tpls);
    setRecurring(rec);

    // Обновляем стрики
    const result = await streakService.updateStreaks(txs);
    setStreakData(result.streakData);
    if (result.newMilestone) setNewMilestone(result.newMilestone);

  };

  useFocusEffect(useCallback(() => { loadData(); }, []));
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
  const recentTx = [...transactions].sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || '')).slice(0, 5);

  // PIE CHART
  const catTotals = {};
  thisMonth.filter(t => t.type === 'expense').forEach(t => {
    const cat = t.categoryId || 'other';
    catTotals[cat] = (catTotals[cat] || 0) + t.amount;
  });
  const pieData = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([cat, amount]) => ({
      name: i18n.t(cat),
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

  return (
    <View style={st.container}>
      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}
        contentContainerStyle={{ paddingBottom: 120 }}>

        <View style={st.header}>
          <View>
            <Text style={st.logo}><Text style={{ color: colors.green }}>Q</Text>aizo</Text>
            <Text style={st.subtitle}>{dateStr}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={st.profileBtn} onPress={() => navigation.navigate('Settings')}>
            <Feather name="settings" size={18} color={colors.textDim} />
          </TouchableOpacity>
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
          </View>
        </View>

        {dashLayout.map(block => {
          if (!block.visible) return null;
          switch (block.id) {
            case 'balance':
              return (
                <Card key="balance" highlighted>
                  <Text style={st.balLabel}>{i18n.t('totalBalance')}</Text>
                  <Amount value={balance} sign style={st.balAmount} color={balance >= 0 ? colors.text : colors.red} numberOfLines={1} adjustsFontSizeToFit />
                  <View style={st.incExpRow}>
                    <View style={st.incExpItem}>
                      <View style={st.incExpHead}>
                        <Feather name="trending-up" size={14} color={colors.green} />
                        <Text style={st.incLabel}> {i18n.t('income')}</Text>
                      </View>
                      <Amount value={totalIncome} style={st.incAmount} color={colors.green} numberOfLines={1} adjustsFontSizeToFit />
                    </View>
                    <View style={st.dividerV} />
                    <View style={st.incExpItem}>
                      <View style={st.incExpHead}>
                        <Feather name="trending-down" size={14} color={colors.red} />
                        <Text style={st.expLabel}> {i18n.t('expenses')}</Text>
                      </View>
                      <Amount value={-totalExpense} sign style={st.expAmount} color={colors.red} numberOfLines={1} adjustsFontSizeToFit />
                    </View>
                  </View>
                </Card>
              );
            case 'streak':
              return <StreakCard key="streak" streakData={streakData} transactions={transactions} weekStart={weekStart} />;
            case 'freeMoneyToday': {
              const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
              const daysLeft = Math.max(lastDay - now.getDate(), 1);

              // === ДОХОД ===
              // 1. Фактический доход этого месяца
              const monthIncome = totalIncome;

              // 2. Ожидаемый recurring income (ещё не поступивший)
              const expectedRecurringIncome = recurring
                .filter(r => r.isActive && r.type === 'income')
                .filter(r => {
                  const nd = new Date(r.nextDate);
                  return nd.getMonth() === now.getMonth() && nd.getFullYear() === now.getFullYear() && nd.getDate() > now.getDate();
                })
                .reduce((s, r) => s + r.amount, 0);

              // 3. Fallback: средний доход за 3 месяца (если нет recurring и мало дохода)
              let avgIncome3m = 0;
              if (monthIncome === 0 && expectedRecurringIncome === 0) {
                let totalInc3m = 0; let months3m = 0;
                for (let i = 1; i <= 3; i++) {
                  const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
                  const mInc = transactions
                    .filter(t => t.type === 'income')
                    .filter(t => { const d = new Date(t.date || t.createdAt); return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear(); })
                    .reduce((s, t) => s + t.amount, 0);
                  if (mInc > 0) { totalInc3m += mInc; months3m++; }
                }
                if (months3m > 0) avgIncome3m = Math.round(totalInc3m / months3m);
              }

              const totalMonthIncome = monthIncome + expectedRecurringIncome + avgIncome3m;
              const hasNoIncomeData = totalMonthIncome === 0;

              // === ОБЯЗАТЕЛЬНЫЕ РАСХОДЫ ===
              const allRecurringExpenses = recurring
                .filter(r => r.isActive && r.type === 'expense')
                .reduce((s, r) => s + r.amount, 0);

              // === ПУЛ НА МЕСЯЦ ===
              const monthPool = totalMonthIncome - allRecurringExpenses + monthlyExtra;

              // === ГИБКИЕ ТРАТЫ (всё кроме recurring) ===
              const flexSpent = thisMonth
                .filter(t => t.type === 'expense' && !t.isTransfer)
                .reduce((s, t) => s + t.amount, 0);

              // === ОСТАТОК / ДНИ ===
              const remainingPool = monthPool - flexSpent;
              const freeToday = Math.floor(remainingPool / daysLeft);
              const isCrisis = monthPool <= 0 && !hasNoIncomeData;
              const freeTodayColor = hasNoIncomeData ? colors.textDim
                : isCrisis ? colors.orange
                : freeToday > 200 ? colors.green
                : freeToday > 50 ? colors.yellow
                : colors.red;

              // Spent today
              const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const spentToday = thisMonth
                .filter(t => t.type === 'expense' && new Date(t.date || t.createdAt) >= todayStart)
                .reduce((s, t) => s + t.amount, 0);

              // Yesterday comparison
              const yStart = new Date(todayStart); yStart.setDate(yStart.getDate() - 1);
              const spentYesterday = thisMonth
                .filter(t => t.type === 'expense')
                .filter(t => { const d = new Date(t.date || t.createdAt); return d >= yStart && d < todayStart; })
                .reduce((s, t) => s + t.amount, 0);
              const yesterdayBudget = remainingPool > 0 ? Math.floor((remainingPool + spentToday) / (daysLeft + 1)) : 0;
              const savedYesterday = yesterdayBudget - spentYesterday;

              // Progress bar: spent vs budget
              const absFree = Math.abs(freeToday) || 1;
              const pct = freeToday > 0 ? Math.min(Math.round((spentToday / absFree) * 100), 100) : 100;
              const barColor = pct > 80 ? colors.red : pct > 50 ? colors.yellow : colors.green;

              return (
                <Card key="freeMoneyToday">
                  <View style={st.freeTop}>
                    <Feather name={hasNoIncomeData ? 'info' : isCrisis ? 'alert-triangle' : 'sun'} size={18} color={freeTodayColor} />
                    <Text style={st.freeLabel}>{i18n.t('freeMoneyToday')}</Text>
                    <Text style={st.freeDays}>{daysLeft} {i18n.t('daysLeft')}</Text>
                  </View>

                  {hasNoIncomeData && (
                    <View style={{ backgroundColor: colors.blue + '12', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                      <Text style={{ color: colors.blue, fontSize: 12, fontWeight: '600' }}>{i18n.t('addIncomeHint')}</Text>
                    </View>
                  )}

                  {isCrisis && !hasNoIncomeData && (
                    <View style={{ backgroundColor: colors.orange + '15', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                      <Text style={{ color: colors.orange, fontSize: 12, fontWeight: '600' }}>{i18n.t('crisisWarning')}</Text>
                    </View>
                  )}

                  <Amount value={freeToday} sign style={st.freeAmount} color={freeTodayColor} numberOfLines={1} adjustsFontSizeToFit />

                  {/* Progress bar */}
                  <View style={st.freeBar}>
                    <View style={[st.freeBarFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                  </View>

                  {/* Details row */}
                  <View style={st.freeDetails}>
                    {spentToday > 0 && (
                      <View style={st.freeDetail}>
                        <Feather name="shopping-cart" size={12} color={colors.red} />
                        <Text style={st.freeDetailTxt}>{i18n.t('spentToday')}: {spentToday.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()}</Text>
                      </View>
                    )}
                    {allRecurringExpenses > 0 && (
                      <View style={st.freeDetail}>
                        <Feather name="repeat" size={12} color={colors.orange} />
                        <Text style={st.freeDetailTxt}>{i18n.t('fixedExpenses')}: {allRecurringExpenses.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()}</Text>
                      </View>
                    )}
                    {savedYesterday !== 0 && spentYesterday > 0 && (
                      <View style={st.freeDetail}>
                        <Feather name={savedYesterday > 0 ? 'trending-down' : 'trending-up'} size={12} color={savedYesterday > 0 ? colors.green : colors.red} />
                        <Text style={[st.freeDetailTxt, { color: savedYesterday > 0 ? colors.green : colors.red }]}>
                          {savedYesterday > 0 ? i18n.t('savedYesterday') : i18n.t('overspentYesterday')}: {Math.abs(savedYesterday).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()}
                        </Text>
                      </View>
                    )}
                  </View>
                </Card>
              );
            }
            case 'pieChart':
              if (pieData.length === 0) return null;
              return (
                <Card key="pieChart">
                  <Text style={st.blockTitle}>{i18n.t('expensesByCategory')}</Text>
                  <InteractivePieChart data={pieData} size={200} />
                </Card>
              );
            case 'budgets':
              if (budgetRows.length === 0) return null;
              return (
                <Card key="budgets">
                  <TouchableOpacity style={st.blockTitleRow} onPress={() => setBudgetsExpanded(!budgetsExpanded)} activeOpacity={0.7}>
                    <Text style={st.blockTitle}>{i18n.t('budgets')}</Text>
                    <View style={st.budgetTitleRight}>
                      {hasBudgets && (
                        <Text style={[st.totalPct, { color: totalBudgetPct > 100 ? colors.red : totalBudgetPct > 80 ? colors.yellow : colors.green }]}>
                          {totalBudgetPct}%
                        </Text>
                      )}
                      <Feather name={budgetsExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
                    </View>
                  </TouchableOpacity>
                  {hasBudgets && (
                    <>
                      <View style={st.totalBudgetRow}>
                        <Text style={st.totalBudgetLabel}>{i18n.t('totalBudget')}</Text>
                        <Text style={st.totalBudgetAmount}>
                          {totalBudgetSpent.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()} / {totalBudgetLimit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()}
                        </Text>
                      </View>
                      <View style={st.barBgThick}>
                        <View style={[st.barFillThick, {
                          width: `${Math.min(totalBudgetPct, 100)}%`,
                          backgroundColor: totalBudgetPct > 100 ? colors.red : totalBudgetPct > 80 ? colors.yellow : colors.green,
                        }]} />
                      </View>
                      <Text style={st.totalBudgetLeft}>
                        {totalBudgetPct <= 100
                          ? `${i18n.t('left')}: ${(totalBudgetLimit - totalBudgetSpent).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${sym()}`
                          : `${i18n.t('over')}: ${(totalBudgetSpent - totalBudgetLimit).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${sym()}`
                        }
                      </Text>
                    </>
                  )}
                  {budgetsExpanded && (
                    <View style={hasBudgets ? { marginTop: 16, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 16 } : undefined}>
                      {budgetRows.map(({ cat, spent, limit, hasBudget: hb }) => {
                        const cfg = categoryConfig[cat] || categoryConfig.other;
                        const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
                        const barColor = !hb ? cfg.color : pct > 100 ? colors.red : pct > 80 ? colors.yellow : cfg.color;
                        return (
                          <TouchableOpacity key={cat} style={st.budgetRow}
                            onPress={() => setBudgetModal({ categoryId: cat, spent })} activeOpacity={0.6}>
                            <View style={st.budgetInfo}>
                              <View style={st.budgetLeft}>
                                <View style={[st.budgetDot, { backgroundColor: cfg.color }]} />
                                <Text style={st.budgetCat}>{i18n.t(cat)}</Text>
                              </View>
                              <View style={st.budgetRight}>
                                {hb ? (
                                  <>
                                    <Text style={[st.budgetPct, { color: barColor }]}>{pct}%</Text>
                                    <Text style={st.budgetAmount}>{spent.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()} / {limit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {sym()}</Text>
                                  </>
                                ) : (
                                  <>
                                    <Amount value={spent} style={st.budgetAmount} />
                                    <Feather name="plus-circle" size={14} color={colors.textMuted} style={{ marginStart: 6 }} />
                                  </>
                                )}
                              </View>
                            </View>
                            <View style={st.barBg}>
                              {hb ? (
                                <View style={[st.barFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }]} />
                              ) : (
                                <View style={[st.barFill, { width: '100%', backgroundColor: cfg.color, opacity: 0.3 }]} />
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </Card>
              );
            case 'recurring':
              if (recurring.length === 0) return null;
              return (
                <View key="recurring">
                  {upcoming.length > 0 ? (
                    <Card>
                      <View style={st.blockTitleRow}>
                        <Text style={st.blockTitle}>{i18n.t('upcomingPayments')}</Text>
                        <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.greenSoft, justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowRecurring(true)}>
                          <Feather name="plus" size={18} color={colors.green} />
                        </TouchableOpacity>
                      </View>
                      {upcoming.map(rec => {
                        const cfg = categoryConfig[rec.categoryId] || categoryConfig.other;
                        const nd = new Date(rec.nextDate);
                        const diffDays = Math.ceil((nd - today) / (1000 * 60 * 60 * 24));
                        const isOverdue = diffDays <= 0;
                        const dateLabel = isOverdue ? i18n.t('today') : diffDays === 1 ? i18n.t('tomorrow') : `${diffDays} ${i18n.t('days')}`;
                        const renderRecSwipeActions = () => (
                          <View style={{ flexDirection: i18n.row() }}>
                            <TouchableOpacity style={[st.recSwipeBtn, { backgroundColor: 'rgba(251,191,36,0.15)' }]}
                              onPress={() => { setEditRecurring(rec); }}>
                              <Feather name="edit-2" size={18} color={colors.yellow} />
                            </TouchableOpacity>
                            <TouchableOpacity style={[st.recSwipeBtn, { backgroundColor: colors.redSoft }]}
                              onPress={() => handleDeleteRecurring(rec.id)}>
                              <Feather name="trash-2" size={18} color={colors.red} />
                            </TouchableOpacity>
                          </View>
                        );
                        return (
                          <Swipeable key={rec.id} renderRightActions={renderRecSwipeActions} renderLeftActions={renderRecSwipeActions} overshootRight={false} overshootLeft={false}>
                            <TouchableOpacity style={st.recRow} onPress={() => setRecDetail(rec)} activeOpacity={0.6}>
                              <View style={[st.recIcon, { backgroundColor: cfg.color + '20' }]}>
                                <Feather name={cfg.icon || 'repeat'} size={18} color={cfg.color} />
                              </View>
                              <View style={st.recInfo}>
                                <Text style={st.recName}>{rec.recipient || i18n.t(rec.categoryId)}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                  <Amount value={rec.type === 'expense' ? -rec.amount : rec.amount} sign style={st.recMeta} color={rec.type === 'expense' ? colors.red : colors.green} />
                                  <Text style={st.recMeta}> · {dateLabel}</Text>
                                </View>
                              </View>
                              <View style={st.recActions}>
                                <TouchableOpacity style={st.recSkip} onPress={() => handleSkipRecurring(rec.id)}>
                                  <Feather name="fast-forward" size={16} color={colors.textMuted} />
                                </TouchableOpacity>
                                <TouchableOpacity style={[st.recConfirm, isOverdue && { backgroundColor: colors.yellow + '20' }]}
                                  onPress={() => handleConfirmRecurring(rec.id)}>
                                  <Feather name="check" size={16} color={isOverdue ? colors.yellow : colors.green} />
                                </TouchableOpacity>
                              </View>
                            </TouchableOpacity>
                          </Swipeable>
                        );
                      })}
                    </Card>
                  ) : (
                    <Card>
                      <Text style={st.blockTitle}>{i18n.t('upcomingPayments')}</Text>
                      <Text style={st.recEmptyTxt}>{i18n.t('noUpcoming')}</Text>
                    </Card>
                  )}
                </View>
              );
            case 'barChart':
              if (!barData.some(d => d.income > 0 || d.expense > 0)) return null;
              return (
                <Card key="barChart">
                  <Text style={st.blockTitle}>{i18n.t('sixMonths')}</Text>
                  <InteractiveBarChart data={barData} maxBar={maxBar} />
                </Card>
              );
            case 'goals':
              if (goals.length === 0) return null;
              return (
                <Card key="goals">
                  <TouchableOpacity style={st.blockTitleRow} onPress={() => navigation.navigate('Goals')}>
                    <Text style={st.blockTitle}>{i18n.t('goals')}</Text>
                    <Feather name="chevron-right" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                  {goals.slice(0, 3).map(goal => {
                    const saved = (goal.initialAmount || 0) + (goal.deposits || []).reduce((s, d) => s + d.amount, 0);
                    const pct = goal.targetAmount > 0 ? Math.min(Math.round((saved / goal.targetAmount) * 100), 100) : 0;
                    const gc = goal.color || '#34d399';
                    return (
                      <View key={goal.id} style={st.goalRow}>
                        <View style={[st.goalDot, { backgroundColor: gc }]} />
                        <View style={st.goalInfo}>
                          <Text style={st.goalName} numberOfLines={1}>{goal.name}</Text>
                          <View style={st.goalBar}>
                            <View style={[st.goalBarFill, { width: `${pct}%`, backgroundColor: gc }]} />
                          </View>
                        </View>
                        <Text style={[st.goalPct, { color: gc }]}>{pct}%</Text>
                      </View>
                    );
                  })}
                </Card>
              );
            case 'recentTx':
              return (
                <Card key="recentTx">
                  <View style={st.blockTitleRow}>
                    <Text style={st.blockTitle}>{i18n.t('recentTransactions')}</Text>
                    <TouchableOpacity><Text style={st.seeAll}>{i18n.t('seeAll')}</Text></TouchableOpacity>
                  </View>
                  {recentTx.length > 0 ? recentTx.map(tx => (
                      <TransactionItem key={tx.id} transaction={tx}
                        onDelete={t => setDeleteTarget(t)}
                        onEdit={t => setEditTx(t)}
                        onDuplicate={handleDuplicate} />
                    )) : (
                      <View style={st.empty}>
                        <Feather name="inbox" size={36} color={colors.textMuted} />
                        <Text style={st.emptyText}>{i18n.t('noTransactions')}</Text>
                      </View>
                    )}
                </Card>
              );
            default: return null;
          }
        })}
      </ScrollView>

      <AddTransactionModal visible={showAdd || !!editTx} onClose={handleCloseModal} onSave={() => loadData()} editTransaction={editTx} />
      <ConfirmModal visible={!!deleteTarget} title={i18n.t('delete')}
        message={deleteTarget ? `${i18n.t(deleteTarget.categoryId)} — ${deleteTarget.amount} ${sym()}` : ''}
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
  logo: { color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -1 },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  profileBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, justifyContent: 'center', alignItems: 'center' },
  balLabel: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 8, textAlign: i18n.isRTL() ? 'right' : 'left' },
  balAmount: { fontSize: 38, fontWeight: '800', letterSpacing: -1.5, marginBottom: 24, writingDirection: 'ltr' },
  incExpRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardHighlight, borderRadius: 14, padding: 16 },
  incExpItem: { flex: 1 },
  incExpHead: { flexDirection: i18n.row(), alignItems: 'center', marginBottom: 6 },
  dividerV: { width: 1, height: 40, backgroundColor: colors.divider, marginHorizontal: 16 },
  incLabel: { color: colors.green, fontSize: 12, fontWeight: '600' },
  incAmount: { color: colors.green, fontSize: 20, fontWeight: '700', paddingStart: 4, writingDirection: 'ltr' },
  expLabel: { color: colors.red, fontSize: 12, fontWeight: '600' },
  expAmount: { color: colors.red, fontSize: 20, fontWeight: '700', paddingStart: 4, writingDirection: 'ltr' },
  blockTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 12, textAlign: i18n.textAlign() },
  blockTitleRow: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  seeAll: { color: colors.green, fontSize: 13, fontWeight: '600' },
  totalPct: { fontSize: 15, fontWeight: '700' },
  budgetTitleRight: { flexDirection: i18n.row(), alignItems: 'center', gap: 8 },
  totalBudgetRow: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  totalBudgetLabel: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  totalBudgetAmount: { color: colors.textDim, fontSize: 13, fontWeight: '600', writingDirection: 'ltr' },
  barBgThick: { height: 10, backgroundColor: colors.bg2, borderRadius: 5, overflow: 'hidden', marginBottom: 8 },
  barFillThick: { height: 10, borderRadius: 5 },
  totalBudgetLeft: { color: colors.textMuted, fontSize: 12, fontWeight: '500', writingDirection: 'ltr' },
  budgetRow: { marginBottom: 16 },
  budgetInfo: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  budgetLeft: { flexDirection: i18n.row(), alignItems: 'center', gap: 8 },
  budgetRight: { flexDirection: i18n.row(), alignItems: 'center' },
  budgetDot: { width: 8, height: 8, borderRadius: 4 },
  budgetCat: { color: colors.textSecondary, fontSize: 14, fontWeight: '600', textAlign: i18n.textAlign() },
  budgetPct: { fontSize: 13, fontWeight: '700', marginEnd: 8 },
  budgetAmount: { color: colors.textDim, fontSize: 13, fontWeight: '600', writingDirection: 'ltr' },
  barBg: { height: 6, backgroundColor: colors.bg2, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  empty: { alignItems: 'center', paddingVertical: 36 },
  emptyText: { color: colors.textMuted, fontSize: 15, fontWeight: '600', marginTop: 12 },
  fab: { position: 'absolute', right: 24, bottom: 100, width: 60, height: 60, borderRadius: 18, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center', shadowColor: colors.green, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10, zIndex: 10 },
  fabOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 5 },
  fabMenu: { position: 'absolute', right: 24, bottom: 170, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.cardBorder, overflow: 'hidden', minWidth: 200 },
  fabMenuItem: { flexDirection: i18n.row(), alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, gap: 12 },
  fabMenuTxt: { color: colors.text, fontSize: 15, fontWeight: '600' },
  fabMenuDivider: { height: 1, backgroundColor: colors.divider },

  // Quick select sheet
  quickSelectSheet: { position: 'absolute', right: 24, left: 24, bottom: 170, backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.cardBorder, padding: 20 },
  quickSelectTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  quickTabs: { flexDirection: i18n.row(), marginBottom: 16, backgroundColor: colors.bg, borderRadius: 12, padding: 3 },
  quickTab: { flex: 1, flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  quickTabActive: { backgroundColor: colors.card },
  quickTabTxt: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  quickEmptyTxt: { color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  addTemplateBtn: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, marginTop: 8 },
  addTemplateTxt: { color: colors.green, fontSize: 13, fontWeight: '600' },
  templateInput: { backgroundColor: colors.bg, borderRadius: 12, padding: 14, color: colors.text, fontSize: 15, marginBottom: 12, borderWidth: 1, borderColor: colors.cardBorder, textAlign: i18n.textAlign() },
  templateLabel: { color: colors.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6, textAlign: i18n.textAlign() },
  templateChip: { flexDirection: i18n.row(), alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.bg, marginEnd: 6, borderWidth: 1.5, borderColor: 'transparent', gap: 4 },
  templateChipTxt: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  templateCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, alignItems: 'center' },
  templateSaveBtn: { flex: 1, flexDirection: i18n.row(), paddingVertical: 14, borderRadius: 12, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', gap: 6 },
  quickSelectGrid: { flexDirection: i18n.row(), flexWrap: 'wrap', justifyContent: 'center', gap: 8 },

  // Quick templates
  quickBtn: { alignItems: 'center', width: 68, paddingVertical: 8 },
  quickIcon: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  quickLabel: { color: colors.textDim, fontSize: 11, fontWeight: '600', textAlign: 'center' },

  // Free money today
  freeTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  freeLabel: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  freeDays: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  freeAmount: { fontSize: 32, fontWeight: '800', letterSpacing: -1, marginBottom: 8, writingDirection: 'ltr' },
  freeBar: { height: 6, backgroundColor: colors.bg2, borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  freeBarFill: { height: 6, borderRadius: 3 },
  freeDetails: { gap: 4 },
  freeDetail: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  freeDetailTxt: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },

  // Recurring
  recRow: { flexDirection: i18n.row(), alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 12 },
  recIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  recInfo: { flex: 1 },
  recName: { color: colors.text, fontSize: 15, fontWeight: '600', textAlign: i18n.textAlign() },
  recMeta: { color: colors.textDim, fontSize: 12, marginTop: 2, writingDirection: 'ltr' },
  recActions: { flexDirection: i18n.row(), gap: 8 },
  recSkip: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.bg2, justifyContent: 'center', alignItems: 'center' },
  recConfirm: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.greenSoft, justifyContent: 'center', alignItems: 'center' },
  recSwipeBtn: { width: 60, justifyContent: 'center', alignItems: 'center' },

  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  goalDot: { width: 8, height: 8, borderRadius: 4 },
  goalInfo: { flex: 1 },
  goalName: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  goalBar: { height: 6, backgroundColor: colors.bg2, borderRadius: 3, overflow: 'hidden' },
  goalBarFill: { height: 6, borderRadius: 3 },
  goalPct: { fontSize: 13, fontWeight: '700', width: 40, textAlign: 'right' },
  recEmpty: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  recEmptyTxt: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },

  // Bell badge
  bellBadge: { position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.red, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  bellBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  // Notifications modal
  notifOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-start', paddingTop: 110, alignItems: 'center' },
  notifModal: { backgroundColor: colors.bg2, borderRadius: 24, marginHorizontal: 20, width: SW - 40, maxHeight: 420, borderWidth: 1, borderColor: colors.cardBorder, overflow: 'hidden' },
  notifHeader: { flexDirection: i18n.row(), alignItems: 'center', gap: 10, padding: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.divider },
  notifTitle: { color: colors.text, fontSize: 17, fontWeight: '700', flex: 1 },
  notifClearBtn: { paddingVertical: 4, paddingHorizontal: 10 },
  notifClearTxt: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  notifEmpty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  notifEmptyTxt: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  notifList: { maxHeight: 340, paddingHorizontal: 20 },
  notifItem: { flexDirection: i18n.row(), alignItems: 'flex-start', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 12 },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green, marginTop: 6 },
  notifItemTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  notifItemBody: { color: colors.textDim, fontSize: 13, lineHeight: 18 },
  notifItemTime: { color: colors.textMuted, fontSize: 11, marginTop: 4 },

  // Milestone celebration
  milestoneOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 20 },
  milestoneCard: { backgroundColor: colors.card, borderRadius: 24, padding: 32, alignItems: 'center', marginHorizontal: 40, borderWidth: 2, borderColor: colors.orange },
  milestoneEmoji: { fontSize: 48, marginBottom: 16 },
  milestoneTxt: { color: colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  milestoneBtn: { backgroundColor: colors.orange, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 },
  milestoneBtnTxt: { color: colors.bg, fontSize: 16, fontWeight: '700' },
});