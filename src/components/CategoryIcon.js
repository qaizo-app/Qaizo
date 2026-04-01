// src/components/CategoryIcon.js
// Монохромные контурные иконки вместо эмодзи
import { Feather, Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { getCatIcon, DEFAULT_GROUPS } from './CategoryPickerModal';
import dataService from '../services/dataService';

let _cachedGroups = null;
export function getCachedGroups() { return _cachedGroups || DEFAULT_GROUPS; }

export default function CategoryIcon({ categoryId, size = 'medium', type }) {
  const [groups, setGroups] = useState(_cachedGroups || DEFAULT_GROUPS);

  useEffect(() => {
    if (!_cachedGroups) {
      dataService.getCategories().then(saved => {
        if (saved && saved.length > 0) {
          _cachedGroups = saved;
          setGroups(saved);
        }
      });
    }
  }, []);

  const { icon, color } = getCatIcon(categoryId, groups);
  const iconColor = color;
  const bgColor = `${iconColor}18`;
 
  const sizes = {
    small:  { box: 36, icon: 16, radius: 10 },
    medium: { box: 44, icon: 20, radius: 13 },
    large:  { box: 52, icon: 24, radius: 16 },
  };
  const s = sizes[size] || sizes.medium;
 
  return (
    <View style={[styles.container, {
      width: s.box, height: s.box, borderRadius: s.radius,
      backgroundColor: bgColor,
    }]}>
      {icon.startsWith('ion:')
        ? <Ionicons name={icon.slice(4)} size={s.icon} color={iconColor} />
        : <Feather name={icon} size={s.icon} color={iconColor} />
      }
    </View>
  );
}
 
const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});