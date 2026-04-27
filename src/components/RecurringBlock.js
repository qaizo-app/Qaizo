// src/components/RecurringBlock.js
// Блок ближайших регулярных платежей со swipe actions
import { Feather } from '@expo/vector-icons';
import { useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Amount from './Amount';
import Card from './Card';
import i18n from '../i18n';
import { categoryConfig, colors } from '../theme/colors';
import { sym } from '../utils/currency';
import { catName } from '../utils/categoryName';
import { getCachedGroups } from '../utils/categoryCache';
import { getCatIcon } from './CategoryPickerModal';

const UPCOMING_PREVIEW = 5;

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
  onShowAll,
}) {
  const accName = (id) => accounts.find(a => a.id === id)?.name || '';
  // Coordinate Swipeables — when one row opens, close the previously open
  // one. Without this, edit/delete actions stay revealed under the row
  // even after swiping back, and bleed visibly into the next row when
  // the user swipes there.
  const swipeRefs = useRef({});
  const openRef = useRef(null);
  const handleSwipeOpen = (id) => {
    const next = swipeRefs.current[id];
    if (openRef.current && openRef.current !== next) {
      openRef.current.close?.();
    }
    openRef.current = next;
  };
  const handleSwipeClose = (id) => {
    if (openRef.current === swipeRefs.current[id]) openRef.current = null;
  };
  if (recurring.length === 0) return null;
  const preview = upcoming.slice(0, UPCOMING_PREVIEW);
  const hasMore = upcoming.length > UPCOMING_PREVIEW;
  return (
    <View>
      {upcoming.length > 0 ? (
        <Card>
          <View style={st.blockTitleRow}>
            <Text style={st.blockTitle}>{i18n.t('upcomingPayments')}</Text>
          </View>
          {preview.map(rec => {
            // Prefer the icon/color captured at save time (covers custom
            // categories), then the cached user groups, then the built-in
            // categoryConfig. Falls back to repeat+muted so we never show
            // the raw "more-horizontal" dots placeholder.
            // Treat 'more-horizontal' (old categoryConfig.other default) and
            // 'repeat' (old AddRecurringModal default before 87cf05b) as
            // placeholders — both mean "we didn't really capture a category
            // icon at save time" and should fall through to the cached
            // groups lookup so custom categories render with their real icon.
            const resolved = !rec.isTransfer && rec.icon && rec.icon !== 'more-horizontal' && rec.icon !== 'repeat'
              ? { icon: rec.icon, color: rec.iconColor || categoryConfig[rec.categoryId]?.color || colors.textDim }
              : null;
            const fromGroups = !rec.isTransfer && !resolved ? getCatIcon(rec.categoryId, getCachedGroups()) : null;
            const cfg = rec.isTransfer
              ? { icon: 'repeat', color: colors.blue }
              : (resolved || (fromGroups && fromGroups.icon !== 'circle' ? fromGroups : categoryConfig[rec.categoryId] || categoryConfig.other));
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
              <Swipeable
                key={rec.id}
                ref={(r) => { swipeRefs.current[rec.id] = r; }}
                onSwipeableWillOpen={() => handleSwipeOpen(rec.id)}
                onSwipeableClose={() => handleSwipeClose(rec.id)}
                renderRightActions={renderRecSwipeActions}
                renderLeftActions={renderRecSwipeActions}
                overshootRight={false}
                overshootLeft={false}
                containerStyle={{ overflow: 'hidden' }}
              >
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
          {hasMore && (
            <TouchableOpacity style={st.showMoreBtn} onPress={() => onShowAll?.()}>
              <Text style={st.showMoreTxt}>
                {i18n.t('showMore')} ({upcoming.length})
              </Text>
              <Feather name={i18n.chevronRight()} size={16} color={colors.green} />
            </TouchableOpacity>
          )}
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
  // Solid bg matches the parent Card so when the row slides back over the
  // swipe-action underlay, the icons get fully covered instead of bleeding
  // through during the close animation.
  recRow: { flexDirection: i18n.row(), alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 12, backgroundColor: colors.card },
  recIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  recInfo: { flex: 1 },
  recName: { color: colors.text, fontSize: 14, fontWeight: '600', textAlign: i18n.textAlign() },
  recMeta: { color: colors.textDim, fontSize: 12, marginTop: 2, writingDirection: 'ltr' },
  recActions: { flexDirection: i18n.row(), gap: 8 },
  recSkip: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.bg2, justifyContent: 'center', alignItems: 'center' },
  recConfirm: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.greenSoft, justifyContent: 'center', alignItems: 'center' },
  recSwipeBtn: { width: 60, justifyContent: 'center', alignItems: 'center' },
  recEmptyTxt: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  showMoreBtn: { flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 12, marginTop: 8 },
  showMoreTxt: { color: colors.green, fontSize: 13, fontWeight: '700' },
});
