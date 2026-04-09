// src/components/BarChartCard.js
// Карточка с bar chart за 6 месяцев
import { StyleSheet, Text } from 'react-native';
import Card from './Card';
import InteractiveBarChart from './InteractiveBarChart';
import i18n from '../i18n';
import { colors } from '../theme/colors';

export default function BarChartCard({ barData, maxBar }) {
  if (!barData.some(d => d.income > 0 || d.expense > 0)) return null;
  return (
    <Card>
      <Text style={st.blockTitle}>{i18n.t('sixMonths')}</Text>
      <InteractiveBarChart data={barData} maxBar={maxBar} />
    </Card>
  );
}

const st = StyleSheet.create({
  blockTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 12, textAlign: i18n.textAlign() },
});
