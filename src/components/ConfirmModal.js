// src/components/ConfirmModal.js
// Тёмный модал подтверждения — замена белому Alert
import { Feather } from '@expo/vector-icons';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import { colors } from '../theme/colors';

export default function ConfirmModal({
  visible, title, message, onConfirm, onCancel,
  confirmText = 'Delete', cancelText = 'Cancel',
  confirmColor = colors.red, icon = 'trash-2',
}) {
  const styles = createStyles();
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={[styles.iconWrap, { backgroundColor: `${confirmColor}15` }]}>
            <Feather name={icon} size={28} color={confirmColor} />
          </View>
 
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
 
          <View style={styles.buttonRow}>
            {cancelText ? (
              <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                <Text style={styles.cancelText}>{cancelText}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: confirmColor }]}
              onPress={onConfirm}
            >
              <Text style={styles.confirmText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
 
const createStyles = () => StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: colors.overlay,
    justifyContent: 'center', alignItems: 'center', padding: 40,
  },
  modal: {
    backgroundColor: colors.bg2, borderRadius: 24, padding: 28,
    width: '100%', alignItems: 'center',
    borderWidth: 1, borderColor: colors.cardBorder,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  title: {
    color: colors.text, fontSize: 18, fontWeight: '700',
    textAlign: 'center', marginBottom: 8,
  },
  message: {
    color: colors.textDim, fontSize: 14, textAlign: 'center',
    lineHeight: 20, marginBottom: 24,
  },
  buttonRow: { flexDirection: i18n.row(), gap: 12, width: '100%' },
  cancelBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 14,
    backgroundColor: colors.card, alignItems: 'center',
    borderWidth: 1, borderColor: colors.cardBorder,
  },
  cancelText: { color: colors.textDim, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  confirmBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center',
  },
  confirmText: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' },
});