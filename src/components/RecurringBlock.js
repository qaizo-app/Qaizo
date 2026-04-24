// src/components/RecurringBlock.js
// Блок ближайших регулярных платежей со swipe actions
import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Amount from './Amount';
import Card from './Card';
import i18n from '../i18n';
import { categoryConfig, colors } from '../theme/colors';
import { sym } from '../utils/currency';
import { catName } from '../utils/categoryName';

export default function RecurringBlock({
  recurring,
  upcoming,
  today,
  accounts = [],
  onAdd,
  onEdit,
  onDelete,
  onSkip,
  onConfirm,
  onDetail,
}) {
  const accName = (id) => accounts.find(a => a.id === id)?.name || '';
  if (recurring.length === 0) return null;
  return (
    <View>
      {upcoming.length > 0 ? (
        <Card>
          <View style={st.blockTitleRow}>
            <Text style={st.blockTitle}>{i18n.t('upcomingPayments')}</Text>
          </View>
          {upcoming.map(rec => {
            const cfg = rec.isTransfer
              ? { icon: 'repeat', color: colors.blue }
              : (categoryConfig[rec.categoryId] || categoryConfig.other);
            const nd = new Date(rec.nextDate);
            const diffDays = Math.ceil((nd - today) / (1000 * 60 * 60 * 24));
            const isOverdue = diffDays <= 0;
            const dateLabel = isOverdue ? i18n.t('today') : diffDays === 1 ? i18n.t('tomorrow') : `${diffDays} ${i18n.t('days')}`;
            const displayName = rec.isTransfer
              ? `${accName(rec.account) || '—'} → ${accName(rec.toAccount) || '—'}`
              : (rec.recipient || catName(rec.categoryId, rec.categoryName));
            const renderRecSwipeActions = () => (
              <View style={{ flexDirection: i18n.row() }}>
                <TouchableOpacity style={[st.recSwipeBtn, { backgroundColor: 'rgba(251,191,36,0.15)' }]}
                  onPress={() => onEdit(rec)}>
                  <Feather name="edit-2" size={18} color={colors.yellow} />
                </TouchableOpacity>
                <TouchableOpacity style={[st.recSwipeBtn, { backgroundColor: colors.redSoft }]}
                  onPress={() => onDelete(rec.id)}>
                  <Feather name="trash-2" size={18} color={colors.red} />
                </TouchableOpacity>
              </View>
            );
            return (
              <Swipeable key={rec.id} renderRightActions={renderRecSwipeActions} renderLeftActions={renderRecSwipeActions} overshootRight={false} overshootLeft={false}>
                <TouchableOpacity style={st.recRow} onPress={() => onDetail(rec)} activeOpacity={0.6}>
                  <View style={[st.recIcon, { backgroundColor: cfg.color + '20' }]}>
                    <Feather name={cfg.icon || 'repeat'} size={18} color={cfg.color} />
                  </View>
                  <View style={st.recInfo}>
                    <Text style={st.recName} numberOfLines={1}>{displayName}</Text>
                    <Text style={st.recMeta} numberOfLines={1}>
                      <Text style={{ color: rec.isTransfer ? colors.blue : (rec.type === 'expense' ? colors.red : colors.green) }}>
                        {rec.isTransfer ? '' : rec.type === 'expense' ? '-' : '+'}{Math.abs(rec.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {sym()}
                      </Text>
                      {' · '}{dateLabel}
                    </Text>
                  </View>
                  <View style={st.recActions}>
                    <TouchableOpacity style={st.recSkip} onPress={() => onSkip(rec.id)}>
                      <Feather name="fast-forward" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[st.recConfirm, isOverdue && { backgroundColor: colors.yellow + '20' }]}
                      onPress={() => onConfirm(rec.id)}>
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
}

const st = StyleSheet.create({
  blockTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 12, textAlign: i18n.textAlign() },
  blockTitleRow: { flexDirection: i18n.row(), justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  recRow: { flexDirection: i18n.row(), alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 12 },
  recIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  recInfo: { flex: 1 },
  recName: { color: colors.text, fontSize: 14, fontWeight: '600', textAlign: i18n.textAlign() },
  recMeta: { color: colors.textDim, fontSize: 12, marginTop: 2, writingDirection: 'ltr' },
  recActions: { flexDirection: i18n.row(), gap: 8 },
  recSkip: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.bg2, justifyContent: 'center', alignItems: 'center' },
  recConfirm: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.greenSoft, justifyContent: 'center', alignItems: 'center' },
  recSwipeBtn: { width: 60, justifyContent: 'center', alignItems: 'center' },
  recEmptyTxt: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
});
