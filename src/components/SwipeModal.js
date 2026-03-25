// src/components/SwipeModal.js
// Обёртка для модалок — свайп вниз по полоске закрывает окно
import { useRef } from 'react';
import { Animated, Dimensions, KeyboardAvoidingView, Modal, PanResponder, Platform, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const CLOSE_THRESHOLD = 100;

export default function SwipeModal({ visible, onClose, children, maxHeight = '92%' }) {
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
    onPanResponderMove: (_, g) => {
      if (g.dy > 0) {
        translateY.setValue(g.dy);
      }
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > CLOSE_THRESHOLD || g.vy > 0.5) {
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }).start(() => {
          translateY.setValue(0);
          onClose();
        });
      } else {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }).start();
      }
    },
  })).current;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.bg2,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 36,
  },
  handleZone: {
    paddingTop: 12,
    paddingBottom: 16,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
    opacity: 0.5,
  },
});