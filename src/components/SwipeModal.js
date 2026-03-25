// src/components/SwipeModal.js
// Исправлен: плавное закрытие без мерцания
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, KeyboardAvoidingView, Modal, PanResponder, Platform, StyleSheet, TouchableWithoutFeedback, View } from 'react-native';
import { colors } from '../theme/colors';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const CLOSE_THRESHOLD = 80;

export default function SwipeModal({ visible, onClose, children, maxHeight = '92%' }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);

  useEffect(() => {
    if (visible) {
      closing.current = false;
      translateY.setValue(0);
    }
  }, [visible]);

  const doClose = () => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 8,
    onPanResponderMove: (_, g) => {
      if (g.dy > 0) translateY.setValue(g.dy);
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > CLOSE_THRESHOLD || g.vy > 0.4) {
        doClose();
      } else {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
      }
    },
  })).current;

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={doClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableWithoutFeedback onPress={doClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
        <Animated.View style={[styles.modal, { maxHeight, transform: [{ translateY }] }]}>
          <View {...panResponder.panHandlers} style={styles.handleZone}>
            <View style={styles.handle} />
          </View>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  modal: { backgroundColor: colors.bg2, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingBottom: 36 },
  handleZone: { paddingTop: 12, paddingBottom: 16, alignItems: 'center' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.textMuted, opacity: 0.5 },
});