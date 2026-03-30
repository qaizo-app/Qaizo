// src/components/SwipeModal.js
// v4: без Modal — чистый Animated.View, никакого мерцания
import { useEffect, useRef } from 'react';
import { Animated, BackHandler, Dimensions, KeyboardAvoidingView, PanResponder, StyleSheet, TouchableWithoutFeedback, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

const SCREEN_H = Dimensions.get('window').height;

export default function SwipeModal({ visible, onClose, children }) {
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const isClosing = useRef(false);
  const insets = useSafeAreaInsets();
  const styles = createStyles();

  useEffect(() => {
    if (visible) {
      isClosing.current = false;
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // Android back button
  useEffect(() => {
    if (!visible) return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      doClose();
      return true;
    });
    return () => handler.remove();
  }, [visible]);

  const doClose = () => {
    if (isClosing.current) return;
    isClosing.current = true;
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: SCREEN_H, duration: 250, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      onClose();
    });
  };

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
    onPanResponderMove: (_, g) => {
      if (g.dy > 0) slideAnim.setValue(g.dy);
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 60 || g.vy > 0.3) {
        doClose();
      } else {
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 120, friction: 14 }).start();
      }
    },
  })).current;

  if (!visible) return null;

  const renderContent = () => {
    if (typeof children === 'function') return children({ close: doClose });
    return children;
  };

  return (
    <View style={styles.fullscreen}>
      {/* Тёмный фон */}
      <TouchableWithoutFeedback onPress={doClose}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      {/* Модалка */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }], paddingBottom: Math.max(insets.bottom, 16) + 40 }]}>
        <View {...panResponder.panHandlers} style={styles.swipeZone}>
          <View style={styles.handle} />
        </View>
        <View style={styles.content}>
          {renderContent()}
        </View>
      </Animated.View>
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  fullscreen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  sheet: {
    backgroundColor: colors.bg2,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  swipeZone: {
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
    opacity: 0.5,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
});