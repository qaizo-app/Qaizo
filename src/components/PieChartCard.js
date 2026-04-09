// src/components/PieChartCard.js
// Карточка с pie chart расходов по категориям
import { StyleSheet, Text } from 'react-native';
import Card from './Card';
import InteractivePieChart from './InteractivePieChart';
import i18n from '../i18n';
import { colors } from '../theme/colors';

export default function PieChartCard({ pieData }) {
  if (pieData.length === 0) return null;
  return (
    <Card>
      <Text style={st.blockTitle}>{i18n.t('expensesByCategory')}</Text>
      <InteractivePieChart data={pieData} size={200} />
    </Card>
  );
}

const st = StyleSheet.create({
  blockTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 12, textAlign: i18n.textAlign() },
});
