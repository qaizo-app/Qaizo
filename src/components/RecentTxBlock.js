// src/components/RecentTxBlock.js
// Блок последних транзакций на дашборде
import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import Card from './Card';
import TransactionItem from './TransactionItem';
import i18n from '../i18n';
import { colors } from '../theme/colors';

export default function RecentTxBlock({ recentTx, onDelete, onEdit, onDuplicate }) {
  return (
    <Card>
      <Text style={st.blockTitle}>{i18n.t('recentTransactions')}</Text>
      {recentTx.length > 0 ? recentTx.map(tx => (
        <TransactionItem key={tx.id} transaction={tx}
          onDelete={onDelete}
          onEdit={onEdit}
          onDuplicate={onDuplicate} />
      )) : (
        <View style={st.empty}>
          <Feather name="inbox" size={36} color={colors.textMuted} />
          <Text style={st.emptyText}>{i18n.t('noTransactions')}</Text>
        </View>
      )}
    </Card>
  );
}

const st = StyleSheet.create({
  blockTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 12, textAlign: i18n.textAlign() },
  empty: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { color: colors.textMuted, fontSize: 14, marginTop: 12 },
});
