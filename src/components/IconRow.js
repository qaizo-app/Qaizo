// src/components/IconRow.js
// Universal RTL/LTR-aware row: icon at reading-start, text after.
//
//   Hebrew:  [text ←←←] [icon]   icon on RIGHT, text RIGHT-aligned
//   English: [icon] [→→→ text]   icon on LEFT,  text LEFT-aligned
//
// Replaces the broken pattern:
//   <View style={{ flexDirection: 'row' }}>
//     <Feather />
//     <Text style={{ flex: 1, textAlign: i18n.textAlign() }}>  ← breaks iOS RTL
//   </View>
//
// Usage:
//   <IconRow icon="home" iconColor={colors.green} text={i18n.t('dashboard')} />
//   <IconRow icon="home" iconColor={colors.green} text={i18n.t('dashboard')} onPress={...} />
//   <IconRow icon="home" iconColor={colors.green} text={i18n.t('dashboard')}
//     right={<Feather name={i18n.chevronRight()} />} />
//   <IconRow icon="plus-circle" iconColor={colors.green} iconBg={colors.green+'20'}
//     text={i18n.t('addExpense')} textStyle={{ fontSize: 16, fontWeight: '600' }} />

import { Feather } from '@expo/vector-icons';
import { Text, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';

export default function IconRow({
  // Icon
  icon,
  iconColor,
  iconSize = 18,
  iconBg,          // if set, wraps icon in a rounded-bg bubble (like add menu items)
  iconBgSize = 44,
  iconBgRadius,    // defaults to iconBgSize / 3

  // Text
  text,
  textStyle,
  textAlign,       // override: 'left' | 'right' | 'center' — default: i18n.textAlign()

  // Custom children instead of text
  children,        // replaces the text block entirely

  // Right slot — chevron, switch, badge, value text, etc.
  right,

  // Container
  onPress,
  style,
  gap = 12,
  disabled,
}) {
  const Container = onPress ? TouchableOpacity : View;
  const resolvedTextAlign = textAlign ?? i18n.textAlign();

  return (
    <Container
      style={[{ flexDirection: i18n.row(), alignItems: 'center', gap }, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {/* Icon — first in JSX = reading-start side (right in Hebrew, left in English) */}
      {icon && (
        iconBg ? (
          <View style={{
            width: iconBgSize,
            height: iconBgSize,
            borderRadius: iconBgRadius ?? Math.round(iconBgSize / 3),
            backgroundColor: iconBg,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Feather name={icon} size={iconSize} color={iconColor} />
          </View>
        ) : (
          <Feather name={icon} size={iconSize} color={iconColor} />
        )
      )}

      {/* Text block — flex:1 on View wrapper (not on Text) to satisfy iOS RTL rule */}
      <View style={{ flex: 1 }}>
        {children ?? (
          // textAlign as inline style — bypasses the global StyleSheet.create patch
          // in App.js that strips textAlign:'right' when I18nManager.isRTL=true
          <Text style={[{ textAlign: resolvedTextAlign }, textStyle]}>
            {text}
          </Text>
        )}
      </View>

      {/* Right slot — rendered last in JSX = reading-end side */}
      {right != null && right}
    </Container>
  );
}
