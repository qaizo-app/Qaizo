// src/components/Amount.js
// Глобальный компонент для отображения сумм — правильный порядок в RTL
// Использование: <Amount value={123.45} /> или <Amount value={-123.45} sign />
import { Text } from 'react-native';
import { sym } from '../utils/currency';

export default function Amount({ value, sign, style, color, numberOfLines, adjustsFontSizeToFit, currency }) {
  const num = typeof value === 'number' ? value : parseFloat(value) || 0;
  const abs = Math.abs(num);
  const formatted = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let prefix = '';
  if (sign && num < 0) prefix = '-';

  // \u200e = LTR mark — forces correct order: -123.45 ₪
  const text = `\u200e${prefix}${formatted} ${currency || sym()}`;

  return (
    <Text style={[{ writingDirection: 'ltr' }, style, color ? { color } : null]}
      numberOfLines={numberOfLines} adjustsFontSizeToFit={adjustsFontSizeToFit}>
      {text}
    </Text>
  );
}
