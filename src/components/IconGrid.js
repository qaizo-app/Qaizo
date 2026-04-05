// src/components/IconGrid.js
// Collapsible icon grid — shows 3 rows + expand button
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import i18n from '../i18n';
import { colors } from '../theme/colors';

const ICONS_PER_ROW = 7;
const VISIBLE_ROWS = 3;
const VISIBLE_COUNT = ICONS_PER_ROW * VISIBLE_ROWS;

export default function IconGrid({ icons, selected, color, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const st = createSt();
  const hasMore = icons.length > VISIBLE_COUNT;
  const visibleIcons = expanded ? icons : icons.slice(0, hasMore ? VISIBLE_COUNT - 1 : VISIBLE_COUNT);

  return (
    <View style={st.grid}>
      {visibleIcons.map(ic => {
        const isIon = ic.startsWith('ion:');
        const isActive = selected === ic;
        return (
          <TouchableOpacity key={ic}
            style={[st.iconBtn, isActive && { borderColor: color, backgroundColor: color + '20' }]}
            onPress={() => onSelect(ic)}>
            {isIon
              ? <Ionicons name={ic.slice(4)} size={20} color={isActive ? color : colors.textMuted} />
              : <Feather name={ic} size={18} color={isActive ? color : colors.textMuted} />
            }
          </TouchableOpacity>
        );
      })}
      {hasMore && !expanded && (
        <TouchableOpacity style={st.expandBtn} onPress={() => setExpanded(true)}>
          <Feather name="plus" size={14} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const createSt = () => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  iconBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1.5, borderColor: 'transparent' },
  expandBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
  expandTxt: { color: colors.textMuted, fontSize: 9, fontWeight: '600', marginTop: -2 },
});
