// src/components/CalculatorModal.js
// Встроенный калькулятор для поля суммы
import { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const BUTTONS = [
  ['C', '⌫', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['00', '0', '.', '='],
];

export default function CalculatorModal({ visible, onClose, onResult, initialValue }) {
  const [display, setDisplay] = useState(initialValue || '');
  const [prevValue, setPrevValue] = useState(null);
  const [operator, setOperator] = useState(null);
  const [waitingForNext, setWaitingForNext] = useState(false);

  const isOp = (key) => ['+', '−', '×', '÷'].includes(key);

  const calculate = (a, b, op) => {
    const na = parseFloat(a) || 0;
    const nb = parseFloat(b) || 0;
    switch (op) {
      case '+': return na + nb;
      case '−': return na - nb;
      case '×': return na * nb;
      case '÷': return nb !== 0 ? na / nb : 0;
      default: return nb;
    }
  };

  const handlePress = (key) => {
    if (key === 'C') {
      setDisplay('');
      setPrevValue(null);
      setOperator(null);
      setWaitingForNext(false);
      return;
    }

    if (key === '⌫') {
      setDisplay(display.slice(0, -1));
      return;
    }

    if (key === '%') {
      const val = parseFloat(display) || 0;
      if (prevValue !== null && operator) {
        // e.g. 200 + 10% = 200 + 20 = 220
        const pct = (parseFloat(prevValue) * val) / 100;
        setDisplay(String(pct));
      } else {
        setDisplay(String(val / 100));
      }
      return;
    }

    if (key === '=') {
      if (prevValue !== null && operator) {
        const result = calculate(prevValue, display, operator);
        const rounded = Math.round(result * 100) / 100;
        setDisplay(String(rounded));
        setPrevValue(null);
        setOperator(null);
        setWaitingForNext(false);
      }
      return;
    }

    if (isOp(key)) {
      if (prevValue !== null && operator && !waitingForNext) {
        const result = calculate(prevValue, display, operator);
        const rounded = Math.round(result * 100) / 100;
        setPrevValue(String(rounded));
        setDisplay(String(rounded));
      } else {
        setPrevValue(display || '0');
      }
      setOperator(key);
      setWaitingForNext(true);
      return;
    }

    // Digit or dot
    if (key === '.' && display.includes('.')) return;
    if (waitingForNext) {
      setDisplay(key === '.' ? '0.' : key);
      setWaitingForNext(false);
    } else {
      setDisplay(display + key);
    }
  };

  const handleDone = () => {
    // Calculate final if pending
    let finalVal = display;
    if (prevValue !== null && operator) {
      const result = calculate(prevValue, display, operator);
      finalVal = String(Math.round(result * 100) / 100);
    }
    const num = parseFloat(finalVal);
    if (!isNaN(num) && num > 0) {
      onResult(String(num));
    }
    onClose();
  };

  const opLabel = operator ? ` ${operator}` : '';

  const st = createSt();

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={st.overlay}>
        <TouchableOpacity style={st.overlayBg} activeOpacity={1} onPress={onClose} />
        <View style={st.container}>
          {/* Display */}
          <View style={st.displayWrap}>
            {prevValue !== null && (
              <Text style={st.prevText}>{prevValue}{opLabel}</Text>
            )}
            <Text style={st.displayText} numberOfLines={1} adjustsFontSizeToFit>
              {display || '0'}
            </Text>
          </View>

          {/* Buttons */}
          {BUTTONS.map((row, ri) => (
            <View key={ri} style={st.row}>
              {row.map((key) => {
                const isOperator = isOp(key);
                const isAction = key === 'C' || key === '⌫' || key === '%';
                const isEquals = key === '=';
                const isActive = isOperator && operator === key && waitingForNext;

                return (
                  <TouchableOpacity key={key}
                    style={[
                      st.btn,
                      isOperator && st.btnOp,
                      isAction && st.btnAction,
                      isEquals && st.btnEquals,
                      isActive && st.btnOpActive,
                    ]}
                    onPress={() => handlePress(key)} activeOpacity={0.6}>
                    <Text style={[
                      st.btnText,
                      isOperator && st.btnOpText,
                      isAction && st.btnActionText,
                      isEquals && st.btnEqualsText,
                    ]}>
                      {key === '⌫' ? '⌫' : key}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          {/* Done button */}
          <TouchableOpacity style={st.doneBtn} onPress={handleDone} activeOpacity={0.8}>
            <Feather name="check" size={20} color={colors.bg} />
            <Text style={st.doneTxt}>{display || '0'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const createSt = () => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  overlayBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  container: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 48 },

  displayWrap: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12, minHeight: 80, justifyContent: 'flex-end', alignItems: 'flex-end', borderWidth: 1, borderColor: colors.cardBorder },
  prevText: { color: colors.textMuted, fontSize: 16, fontWeight: '500', marginBottom: 4 },
  displayText: { color: colors.text, fontSize: 36, fontWeight: '800', writingDirection: 'ltr' },

  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  btn: { flex: 1, height: 56, borderRadius: 14, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.cardBorder },
  btnText: { color: colors.text, fontSize: 22, fontWeight: '600' },

  btnOp: { backgroundColor: colors.greenSoft },
  btnOpText: { color: colors.green, fontWeight: '700' },
  btnOpActive: { backgroundColor: colors.green },

  btnAction: { backgroundColor: colors.bg2 },
  btnActionText: { color: colors.textDim, fontSize: 18 },

  btnEquals: { backgroundColor: colors.green },
  btnEqualsText: { color: colors.bg, fontWeight: '800' },

  doneBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.green, borderRadius: 14, paddingVertical: 16, marginTop: 4 },
  doneTxt: { color: colors.bg, fontSize: 18, fontWeight: '700' },
});
