// src/components/Card.js
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';
 
export default function Card({ children, style, highlighted }) {
  return (
    <View style={[
      styles.card,
      highlighted && styles.highlighted,
      style
    ]}>
      {children}
    </View>
  );
}
 
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 12,
    marginHorizontal: 20,
  },
  highlighted: {
    borderColor: 'rgba(52, 211, 153, 0.20)',
    backgroundColor: colors.card,
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
});