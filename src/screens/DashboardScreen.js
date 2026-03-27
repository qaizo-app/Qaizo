// src/screens/DashboardScreen.js
// Графики: pie chart категорий, bar chart по месяцам, бюджеты с прогресс-барами
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { PieChart } from 'react-native-chart-kit';
import AddRecurringModal from '../components/AddRecurringModal';
import AddTransactionModal from '../components/AddTransactionModal';
import BudgetModal from '../components/BudgetModal';
import Card from '../components/Card';
import ConfirmModal from '../components/ConfirmModal';
import QuickAddModal from '../components/QuickAddModal';
import SmartInputModal from '../components/SmartInputModal';
import RecurringDetailModal from '../components/RecurringDetailModal';
import StreakCard from '../components/StreakCard';
import TransactionItem from '../components/TransactionItem';
import i18n from '../i18n';
import dataService from '../services/dataService';
import streakService from '../services/streakService';
import { useToast } from '../components/ToastProvider';
import notificationService from '../services/notificationService';
import { categoryConfig, colors } from '../theme/colors';
import { sym } from '../utils/currency';

const SW = Dimensions.get('window').width;

export default function DashboardScreen() {
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
  const [showSmartInput, setShowSmartInput] = useState(false);
  const [streakData, setStreakData] = useState(null);
  const [newMilestone, setNewMilestone] = useState(null);
  const [weekStart, setWeekStart] = useState('monday');
  const [notifications, setNotifications] = useState([]);
  const [showNotifModal, setShowNotifModal] = useState(false);
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
    const [txs, bdg, rec, settings] = await Promise.all([
      dataService.getTransactions(),
      dataService.getBudgets(),
      dataService.getRecurring(),
      dataService.getSettings(),
    ]);
    if (settings.weekStart) setWeekStart(settings.weekStart);
    setTransactions(txs);
    setBudgets(bdg);
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
  const recentTx = transactions.slice(0, 5);

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
    barData.push({ month: mNames[m.getMonth()], income: inc, expense: exp });
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

        <Card highlighted>
          <Text style={st.balLabel}>{i18n.t('totalBalance')}</Text>
          <Text style={[st.balAmount, { color: balance >= 0 ? colors.text : colors.red }]}>{sym()} {balance.toLocaleString()}</Text>
          <View style={st.incExpRow}>
            <View style={st.incExpItem}>
              <View style={st.incExpHead}>
                <Feather name="trending-up" size={14} color={colors.green} />
                <Text style={st.incLabel}> {i18n.t('income')}</Text>
              </View>
              <Text style={st.incAmount}>{sym()} {totalIncome.toLocaleString()}</Text>
            </View>
            <View style={st.dividerV} />
            <View style={st.incExpItem}>
              <View style={st.incExpHead}>
                <Feather name="trending-down" size={14} color={colors.red} />
                <Text style={st.expLabel}> {i18n.t('expenses')}</Text>
              </View>
              <Text style={st.expAmount}>{sym()} {totalExpense.toLocaleString()}</Text>
            </View>
          </View>
        </Card>

        {/* ─── STREAK ─────────────────────────────────── */}
        <StreakCard streakData={streakData} transactions={transactions} weekStart={weekStart} />

        {/* ─── FREE MONEY TODAY ─────────────────────────── */}
        {balance > 0 && (() => {
          const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          const daysLeft = Math.max(lastDay - now.getDate(), 1);
          const freeToday = Math.floor(balance / daysLeft);
          const freeTodayColor = freeToday > 200 ? colors.green : freeToday > 50 ? colors.yellow : colors.red;
          return (
            <Card>
              <View style={st.freeTop}>
                <Feather name="sun" size={18} color={freeTodayColor} />
                <Text style={st.freeLabel}>{i18n.t('freeMoneyToday')}</Text>
              </View>
              <Text style={[st.freeAmount, { color: freeTodayColor }]}>{sym()}{freeToday.toLocaleString()}</Text>
              <Text style={st.freeSub}>{daysLeft} {i18n.t('daysLeft')}</Text>
            </Card>
          );
        })()}

        {pieData.length > 0 && (
          <>
            <View style={st.sectionHeader}>
              <Text style={st.sectionTitle}>{i18n.t('expensesByCategory')}</Text>
            </View>
            <Card>
              <PieChart
                data={pieData}
                width={SW - 88}
                height={180}
                chartConfig={{ color: () => colors.textDim }}
                accessor="amount"
                backgroundColor="transparent"
                paddingLeft="0"
                center={[0, 0]}
                hasLegend={true}
                absolute
              />
            </Card>
          </>
        )}

        {budgetRows.length > 0 && (
          <>
            <View style={st.sectionHeader}>
              <Text style={st.sectionTitle}>{i18n.t('budgets')}</Text>
              {hasBudgets && (
                <Text style={[st.totalPct, { color: totalBudgetPct > 100 ? colors.red : totalBudgetPct > 80 ? colors.yellow : colors.green }]}>
                  {totalBudgetPct}%
                </Text>
              )}
            </View>

            {hasBudgets && (
              <Card>
                <View style={st.totalBudgetRow}>
                  <Text style={st.totalBudgetLabel}>{i18n.t('totalBudget')}</Text>
                  <Text style={st.totalBudgetAmount}>
                    {sym()}{totalBudgetSpent.toLocaleString()} / {sym()}{totalBudgetLimit.toLocaleString()}
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
                    ? `${i18n.t('left')}: ${sym()}${(totalBudgetLimit - totalBudgetSpent).toLocaleString()}`
                    : `${i18n.t('over')}: ${sym()}${(totalBudgetSpent - totalBudgetLimit).toLocaleString()}`
                  }
                </Text>
              </Card>
            )}

            <Card>
              {budgetRows.map(({ cat, spent, limit, hasBudget }) => {
                const cfg = categoryConfig[cat] || categoryConfig.other;
                const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
                const barColor = !hasBudget ? cfg.color : pct > 100 ? colors.red : pct > 80 ? colors.yellow : cfg.color;
                return (
                  <TouchableOpacity key={cat} style={st.budgetRow}
                    onPress={() => setBudgetModal({ categoryId: cat, spent })} activeOpacity={0.6}>
                    <View style={st.budgetInfo}>
                      <View style={st.budgetLeft}>
                        <View style={[st.budgetDot, { backgroundColor: cfg.color }]} />
                        <Text style={st.budgetCat}>{i18n.t(cat)}</Text>
                      </View>
                      <View style={st.budgetRight}>
                        {hasBudget ? (
                          <>
                            <Text style={[st.budgetPct, { color: barColor }]}>{pct}%</Text>
                            <Text style={st.budgetAmount}>{sym()}{spent.toLocaleString()} / {sym()}{limit.toLocaleString()}</Text>
                          </>
                        ) : (
                          <>
                            <Text style={st.budgetAmount}>{sym()}{spent.toLocaleString()}</Text>
                            <Feather name="plus-circle" size={14} color={colors.textMuted} style={{ marginStart: 6 }} />
                          </>
                        )}
                      </View>
                    </View>
                    <View style={st.barBg}>
                      {hasBudget ? (
                        <View style={[st.barFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }]} />
                      ) : (
                        <View style={[st.barFill, { width: '100%', backgroundColor: cfg.color, opacity: 0.3 }]} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </Card>
          </>
        )}

        {/* ─── UPCOMING RECURRING PAYMENTS ────────────── */}
        {recurring.length > 0 && (
          <>
            <View style={st.sectionHeader}>
              <Text style={st.sectionTitle}>{i18n.t('upcomingPayments')}</Text>
              <TouchableOpacity onPress={() => setShowRecurring(true)}>
                <Feather name="plus-circle" size={20} color={colors.green} />
              </TouchableOpacity>
            </View>
            {upcoming.length > 0 ? (
              <Card>
                {upcoming.map(rec => {
                  const cfg = categoryConfig[rec.categoryId] || categoryConfig.other;
                  const nd = new Date(rec.nextDate);
                  const diffDays = Math.ceil((nd - today) / (1000 * 60 * 60 * 24));
                  const isOverdue = diffDays <= 0;
                  const dateLabel = isOverdue
                    ? i18n.t('today')
                    : diffDays === 1 ? i18n.t('tomorrow')
                    : `${diffDays} ${i18n.t('days')}`;
                  return (
                    <TouchableOpacity key={rec.id} style={st.recRow} onPress={() => setRecDetail(rec)} activeOpacity={0.6}>
                      <View style={[st.recIcon, { backgroundColor: cfg.color + '20' }]}>
                        <Feather name={cfg.icon || 'repeat'} size={18} color={cfg.color} />
                      </View>
                      <View style={st.recInfo}>
                        <Text style={st.recName}>{rec.recipient || i18n.t(rec.categoryId)}</Text>
                        <Text style={st.recMeta}>
                          {rec.type === 'expense' ? '-' : '+'}{sym()}{rec.amount.toLocaleString()} · {dateLabel}
                        </Text>
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
                  );
                })}
              </Card>
            ) : (
              <Card>
                <Text style={st.recEmptyTxt}>{i18n.t('noUpcoming')}</Text>
              </Card>
            )}
          </>
        )}

        {barData.some(d => d.income > 0 || d.expense > 0) && (
          <>
            <View style={st.sectionHeader}>
              <Text style={st.sectionTitle}>{i18n.t('sixMonths')}</Text>
            </View>
            <Card>
              <View style={st.barChart}>
                {barData.map((d, idx) => (
                  <View key={idx} style={st.barGroup}>
                    <View style={st.barsWrap}>
                      <View style={[st.bar, st.barIncome, { height: Math.max((d.income / maxBar) * 100, 2) }]} />
                      <View style={[st.bar, st.barExpense, { height: Math.max((d.expense / maxBar) * 100, 2) }]} />
                    </View>
                    <Text style={st.barLabel}>{d.month}</Text>
                  </View>
                ))}
              </View>
              <View style={st.barLegend}>
                <View style={st.legendItem}>
                  <View style={[st.legendDot, { backgroundColor: colors.green }]} />
                  <Text style={st.legendText}>{i18n.t('income')}</Text>
                </View>
                <View style={st.legendItem}>
                  <View style={[st.legendDot, { backgroundColor: colors.red }]} />
                  <Text style={st.legendText}>{i18n.t('expenses')}</Text>
                </View>
              </View>
            </Card>
          </>
        )}

        <View style={st.sectionHeader}>
          <Text style={st.sectionTitle}>{i18n.t('recentTransactions')}</Text>
          <TouchableOpacity><Text style={st.seeAll}>{i18n.t('seeAll')}</Text></TouchableOpacity>
        </View>

        <Card>
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
      </ScrollView>

      {/* FAB Menu */}
      {showFabMenu && (
        <TouchableOpacity style={st.fabOverlay} activeOpacity={1} onPress={() => setShowFabMenu(false)}>
          <View style={st.fabMenu}>
            <TouchableOpacity style={st.fabMenuItem} onPress={() => { setShowFabMenu(false); setShowSmartInput(true); }}>
              <Feather name="mic" size={18} color={colors.blue} />
              <Text style={st.fabMenuTxt}>{i18n.t('smartInput')}</Text>
            </TouchableOpacity>
            <View style={st.fabMenuDivider} />
            <TouchableOpacity style={st.fabMenuItem} onPress={() => { setShowFabMenu(false); setShowRecurring(true); }}>
              <Feather name="repeat" size={18} color={colors.teal} />
              <Text style={st.fabMenuTxt}>{i18n.t('recurringPayment')}</Text>
            </TouchableOpacity>
            <View style={st.fabMenuDivider} />
            <TouchableOpacity style={st.fabMenuItem} onPress={() => { setShowFabMenu(false); setShowAdd(true); }}>
              <Feather name="plus" size={18} color={colors.green} />
              <Text style={st.fabMenuTxt}>{i18n.t('oneTimePayment')}</Text>
            </TouchableOpacity>
            <View style={st.fabMenuDivider} />
            <TouchableOpacity style={st.fabMenuItem} onPress={() => { setShowFabMenu(false); setShowQuickSelect(true); }}>
              <Feather name="zap" size={18} color={colors.yellow} />
              <Text style={st.fabMenuTxt}>{i18n.t('quickAdd')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {/* FAB */}
      <TouchableOpacity style={st.fab} onPress={() => setShowFabMenu(!showFabMenu)} activeOpacity={0.8}>
        <Feather name={showFabMenu ? 'x' : 'plus'} size={26} color={colors.bg} />
      </TouchableOpacity>

      <AddTransactionModal visible={showAdd || !!editTx} onClose={handleCloseModal} onSave={() => loadData()} editTransaction={editTx} />
      <ConfirmModal visible={!!deleteTarget} title={i18n.t('delete')}
        message={deleteTarget ? `${i18n.t(deleteTarget.categoryId)} — ${sym()}${deleteTarget.amount}` : ''}
        confirmText={i18n.t('delete')} cancelText={i18n.t('cancel')}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
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
            <View style={st.quickSelectGrid}>
              {[
                { categoryId: 'food', icon: 'shopping-cart', recipient: '', defaultAmount: null },
                { categoryId: 'restaurant', icon: 'coffee', recipient: '', defaultAmount: null },
                { categoryId: 'fuel', icon: 'droplet', recipient: '', defaultAmount: null },
                { categoryId: 'transport', icon: 'navigation', recipient: '', defaultAmount: null },
                { categoryId: 'health', icon: 'heart', recipient: '', defaultAmount: null },
                { categoryId: 'phone', icon: 'smartphone', recipient: '', defaultAmount: null },
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
          </View>
        </TouchableOpacity>
      )}
      <QuickAddModal visible={!!quickTemplate} template={quickTemplate}
        onClose={() => setQuickTemplate(null)} onSaved={() => loadData()} />
      <SmartInputModal visible={showSmartInput}
        onClose={() => setShowSmartInput(false)} onSaved={() => loadData()} />

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
    </View>
  );
}

const createSt = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 24 },
  logo: { color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -1 },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  profileBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, justifyContent: 'center', alignItems: 'center' },
  balLabel: { color: colors.textDim, fontSize: 13, marginBottom: 8 },
  balAmount: { fontSize: 38, fontWeight: '800', letterSpacing: -1.5, marginBottom: 24 },
  incExpRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardHighlight, borderRadius: 14, padding: 16 },
  incExpItem: { flex: 1 },
  incExpHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  dividerV: { width: 1, height: 40, backgroundColor: colors.divider, marginHorizontal: 16 },
  incLabel: { color: colors.green, fontSize: 12, fontWeight: '600' },
  incAmount: { color: colors.green, fontSize: 20, fontWeight: '700', paddingStart: 4 },
  expLabel: { color: colors.red, fontSize: 12, fontWeight: '600' },
  expAmount: { color: colors.red, fontSize: 20, fontWeight: '700', paddingStart: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginTop: 28, marginBottom: 12 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  seeAll: { color: colors.green, fontSize: 13, fontWeight: '600' },
  totalPct: { fontSize: 15, fontWeight: '700' },
  totalBudgetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  totalBudgetLabel: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  totalBudgetAmount: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  barBgThick: { height: 10, backgroundColor: colors.bg2, borderRadius: 5, overflow: 'hidden', marginBottom: 8 },
  barFillThick: { height: 10, borderRadius: 5 },
  totalBudgetLeft: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  budgetRow: { marginBottom: 16 },
  budgetInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  budgetLeft: { flexDirection: 'row', alignItems: 'center' },
  budgetRight: { flexDirection: 'row', alignItems: 'center' },
  budgetDot: { width: 8, height: 8, borderRadius: 4, marginEnd: 8 },
  budgetCat: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  budgetPct: { fontSize: 13, fontWeight: '700', marginEnd: 8 },
  budgetAmount: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  barBg: { height: 6, backgroundColor: colors.bg2, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  barChart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120, paddingTop: 8 },
  barGroup: { flex: 1, alignItems: 'center' },
  barsWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginBottom: 8 },
  bar: { width: 14, borderRadius: 4, minHeight: 2 },
  barIncome: { backgroundColor: colors.green },
  barExpense: { backgroundColor: colors.red },
  barLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
  barLegend: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginEnd: 6 },
  legendText: { color: colors.textDim, fontSize: 11, fontWeight: '500' },
  empty: { alignItems: 'center', paddingVertical: 36 },
  emptyText: { color: colors.textMuted, fontSize: 15, fontWeight: '600', marginTop: 12 },
  fab: { position: 'absolute', right: 24, bottom: 100, width: 60, height: 60, borderRadius: 18, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center', shadowColor: colors.green, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10, zIndex: 10 },
  fabOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 5 },
  fabMenu: { position: 'absolute', right: 24, bottom: 170, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.cardBorder, overflow: 'hidden', minWidth: 200 },
  fabMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, gap: 12 },
  fabMenuTxt: { color: colors.text, fontSize: 15, fontWeight: '600' },
  fabMenuDivider: { height: 1, backgroundColor: colors.divider },

  // Quick select sheet
  quickSelectSheet: { position: 'absolute', right: 24, left: 24, bottom: 170, backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.cardBorder, padding: 20 },
  quickSelectTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  quickSelectGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },

  // Quick templates
  quickBtn: { alignItems: 'center', width: 68, paddingVertical: 8 },
  quickIcon: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  quickLabel: { color: colors.textDim, fontSize: 11, fontWeight: '600', textAlign: 'center' },

  // Free money today
  freeTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  freeLabel: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  freeAmount: { fontSize: 32, fontWeight: '800', letterSpacing: -1, marginBottom: 4 },
  freeSub: { color: colors.textMuted, fontSize: 12 },

  // Recurring
  recRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  recIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginEnd: 12 },
  recInfo: { flex: 1 },
  recName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  recMeta: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  recActions: { flexDirection: 'row', gap: 8 },
  recSkip: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.bg2, justifyContent: 'center', alignItems: 'center' },
  recConfirm: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.greenSoft, justifyContent: 'center', alignItems: 'center' },
  recEmpty: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  recEmptyTxt: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },

  // Bell badge
  bellBadge: { position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.red, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  bellBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  // Notifications modal
  notifOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-start', paddingTop: 110, alignItems: 'center' },
  notifModal: { backgroundColor: colors.bg2, borderRadius: 24, marginHorizontal: 20, width: SW - 40, maxHeight: 420, borderWidth: 1, borderColor: colors.cardBorder, overflow: 'hidden' },
  notifHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.divider },
  notifTitle: { color: colors.text, fontSize: 17, fontWeight: '700', flex: 1 },
  notifClearBtn: { paddingVertical: 4, paddingHorizontal: 10 },
  notifClearTxt: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  notifEmpty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  notifEmptyTxt: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  notifList: { maxHeight: 340, paddingHorizontal: 20 },
  notifItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 12 },
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