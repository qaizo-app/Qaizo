// src/components/CategoryIcon.js
// Монохромные контурные иконки вместо эмодзи
import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { categoryConfig } from '../theme/colors';
 
export default function CategoryIcon({ categoryId, size = 'medium', type }) {
  const config = categoryConfig[categoryId] || categoryConfig.other;
  const iconColor = config.color;
  const bgColor = `${iconColor}18`; // 18 = ~10% opacity in hex
 
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
      <Feather name={config.icon} size={s.icon} color={iconColor} />
    </View>
  );
}
 
const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});