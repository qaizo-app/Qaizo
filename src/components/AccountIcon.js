// src/components/AccountIcon.js
// Иконки счетов — MaterialCommunityIcons (bank, wallet, bitcoin и т.д.)
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View } from 'react-native';
import { accountTypeConfig } from '../theme/colors';

export default function AccountIcon({ type, size = 18, style }) {
  const cfg = accountTypeConfig[type] || accountTypeConfig.bank;
  const boxSize = size + 26;

  return (
    <View style={[{
      width: boxSize, height: boxSize, borderRadius: boxSize * 0.3,
      backgroundColor: `${cfg.color}18`,
      justifyContent: 'center', alignItems: 'center',
    }, style]}>
      <MaterialCommunityIcons name={cfg.icon} size={size} color={cfg.color} />
    </View>
  );
}