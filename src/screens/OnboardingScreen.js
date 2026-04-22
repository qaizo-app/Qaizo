// src/screens/OnboardingScreen.js
// Promo slides + interactive toggles (reminder + privacy consent)
import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, FlatList, Linking, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import i18n from '../i18n';
import consentService from '../services/consentService';
import notificationService from '../services/notificationService';
import { colors } from '../theme/colors';

const { width: SW } = Dimensions.get('window');

const SLIDES = [
  { type: 'info', icon: 'bar-chart-2', color: colors.green, titleKey: 'onb1Title', subKey: 'onb1Sub', features: ['onb1f1', 'onb1f2', 'onb1f3'] },
  { type: 'info', icon: 'cpu', color: '#a78bfa', titleKey: 'onb2Title', subKey: 'onb2Sub', features: ['onb2f1', 'onb2f2', 'onb2f3'] },
  { type: 'info', icon: 'mic', color: '#f472b6', titleKey: 'onb3Title', subKey: 'onb3Sub', features: ['onb3f1', 'onb3f2', 'onb3f3'] },
  { type: 'info', icon: 'repeat', color: colors.blue, titleKey: 'onb4Title', subKey: 'onb4Sub', features: ['onb4f1', 'onb4f2', 'onb4f3'] },
  { type: 'info', icon: 'zap', color: '#fb923c', titleKey: 'onb5Title', subKey: 'onb5Sub', features: ['onb5f1', 'onb5f2', 'onb5f3'] },
  { type: 'info', icon: 'shield', color: '#2dd4bf', titleKey: 'onb6Title', subKey: 'onb6Sub', features: ['onb6f1', 'onb6f2', 'onb6f3'] },
  { type: 'toggle', icon: 'bell', color: '#fbbf24', titleKey: 'onbReminderTitle', subKey: 'onbReminderSub',
    toggleLabel: 'onbReminderToggle', infoText: 'onbReminderInfo',
    stateKey: 'reminder', defaultValue: true },
  { type: 'toggle', icon: 'shield', color: '#34d399', titleKey: 'onbPrivacyTitle', subKey: 'onbPrivacySub',
    toggleLabel: 'onbPrivacyToggle', infoText: 'onbPrivacyInfo',
    stateKey: 'crashReports', defaultValue: true, showLegal: true },
];

function InfoSlide({ item, isActive }) {
  const iconScale = useRef(new Animated.Value(0)).current;
  const titleFade = useRef(new Animated.Value(0)).current;
  const featureFades = useRef(item.features.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (isActive) {
      iconScale.setValue(0); titleFade.setValue(0);
      featureFades.forEach(f => f.setValue(0));
      Animated.sequence([
        Animated.spring(iconScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.timing(titleFade, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.stagger(120, featureFades.map(f =>
          Animated.timing(f, { toValue: 1, duration: 250, useNativeDriver: true })
        )),
      ]).start();
    }
  }, [isActive]);

  return (
    <View style={st.slideContent}>
      <Animated.View style={[st.iconCircle, { backgroundColor: `${item.color}15`, transform: [{ scale: iconScale }] }]}>
        <View style={[st.iconInner, { backgroundColor: `${item.color}25` }]}>
          <Feather name={item.icon} size={48} color={item.color} />
        </View>
      </Animated.View>
      <Animated.View style={{ opacity: titleFade, transform: [{ translateY: titleFade.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
        <Text style={st.title}>{i18n.t(item.titleKey)}</Text>
        <Text style={st.subtitle}>{i18n.t(item.subKey)}</Text>
      </Animated.View>
      <View style={st.featureList}>
        {item.features.map((fk, idx) => (
          <Animated.View key={idx} style={[st.featureRow, { opacity: featureFades[idx], transform: [{ translateX: featureFades[idx].interpolate({ inputRange: [0, 1], outputRange: [i18n.isRTL() ? -30 : 30, 0] }) }] }]}>
            <View style={[st.featureDot, { backgroundColor: item.color }]} />
            <Text style={st.featureText}>{i18n.t(fk)}</Text>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

function ToggleSlide({ item, value, onChange }) {
  const iconScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    iconScale.setValue(0);
    Animated.spring(iconScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
  }, [item.titleKey]);

  return (
    <View style={st.slideContent}>
      <Animated.View style={[st.iconCircle, { backgroundColor: `${item.color}15`, transform: [{ scale: iconScale }] }]}>
        <View style={[st.iconInner, { backgroundColor: `${item.color}25` }]}>
          <Feather name={item.icon} size={48} color={item.color} />
        </View>
      </Animated.View>

      <Text style={st.title}>{i18n.t(item.titleKey)}</Text>
      <Text style={st.subtitle}>{i18n.t(item.subKey)}</Text>

      {/* Toggle row */}
      <View style={[st.toggleCard, { borderColor: `${item.color}40`, backgroundColor: `${item.color}08` }]}>
        <Text style={st.toggleLabel}>{i18n.t(item.toggleLabel)}</Text>
        <Switch value={value} onValueChange={onChange}
          trackColor={{ false: colors.cardBorder, true: `${item.color}60` }}
          thumbColor={value ? item.color : colors.textMuted} />
      </View>

      {/* Info hint */}
      <View style={st.infoRow}>
        <Feather name="info" size={14} color={colors.textMuted} />
        <Text style={st.infoText}>{i18n.t(item.infoText)}</Text>
      </View>

      {item.showLegal && (
        <View style={st.legalRow}>
          <Text style={st.legalText}>
            {i18n.t('onbPrivacyLegal')}{' '}
            <Text style={st.legalLink} onPress={() => Linking.openURL('https://qaizo.app/privacy-policy.html')}>
              {i18n.t('privacyPolicy')}
            </Text>
            {' · '}
            <Text style={st.legalLink} onPress={() => Linking.openURL('https://qaizo.app/terms.html')}>
              {i18n.t('termsOfService')}
            </Text>
          </Text>
        </View>
      )}
    </View>
  );
}

export default function OnboardingScreen({ onDone }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [toggleStates, setToggleStates] = useState(() => {
    const initial = {};
    SLIDES.forEach(s => { if (s.type === 'toggle') initial[s.stateKey] = s.defaultValue; });
    return initial;
  });
  const flatListRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const onViewRef = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) setCurrentIndex(viewableItems[0].index || 0);
  });
  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 50 });

  const isLast = currentIndex === SLIDES.length - 1;

  const saveConsentsAndFinish = async () => {
    try {
      await consentService.setReminderConsent(toggleStates.reminder === true);
      await consentService.setCrashReportsConsent(toggleStates.crashReports === true);
      // If the user opted in, kick off permission request and schedule right
      // now — App.js already finished its init before the user saw this screen.
      if (toggleStates.reminder === true) {
        const granted = await notificationService.requestPermission();
        if (granted) {
          await notificationService.scheduleRecurringNotifications();
          await notificationService.scheduleStreakReminder();
          await notificationService.scheduleWeeklySummary();
        }
      }
    } catch (e) {}
    onDone();
  };

  const goNext = () => {
    if (isLast) saveConsentsAndFinish();
    else flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
  };

  const renderSlide = ({ item, index }) => (
    <View style={[st.slide, { width: SW }]}>
      {item.type === 'info'
        ? <InfoSlide item={item} isActive={index === currentIndex} />
        : <ToggleSlide item={item}
            value={toggleStates[item.stateKey]}
            onChange={(v) => setToggleStates(s => ({ ...s, [item.stateKey]: v }))} />}
    </View>
  );

  return (
    <View style={st.container}>
      <View style={st.logoRow}>
        <Text style={st.logo}>Q<Text style={st.logoAi}>ai</Text>zo</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onViewableItemsChanged={onViewRef.current}
        viewabilityConfig={viewConfigRef.current}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        bounces={false}
      />

      <View style={[st.bottom, { paddingBottom: Math.max(insets.bottom, 16) + 20 }]}>
        <View style={st.dots}>
          {SLIDES.map((s, i) => {
            const inputRange = [(i - 1) * SW, i * SW, (i + 1) * SW];
            const scale = scrollX.interpolate({ inputRange, outputRange: [1, 1.4, 1], extrapolate: 'clamp' });
            const opacity = scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
            return (
              <Animated.View key={i} style={[st.dot, { backgroundColor: s.color, transform: [{ scale }], opacity }]} />
            );
          })}
        </View>

        <View style={st.btnRow}>
          <TouchableOpacity style={st.skipBtn} onPress={saveConsentsAndFinish}>
            <Text style={st.skipTxt}>{i18n.t('skip')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.nextBtn, { backgroundColor: SLIDES[currentIndex].color }]}
            onPress={goNext}
            activeOpacity={0.8}
          >
            <Text style={st.nextTxt}>{isLast ? i18n.t('getStarted') : i18n.t('next')}</Text>
            <Feather name={isLast ? 'check' : (i18n.isRTL() ? 'arrow-left' : 'arrow-right')} size={18} color={colors.bg} style={{ marginStart: 6 }} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  logoRow: { paddingTop: 60, alignItems: 'center', marginBottom: 8 },
  logo: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  logoAi: { color: colors.green, fontSize: 28, fontWeight: '800' },

  slide: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  slideContent: { alignItems: 'center', paddingHorizontal: 40 },

  iconCircle: { width: 140, height: 140, borderRadius: 70, justifyContent: 'center', alignItems: 'center', marginBottom: 32 },
  iconInner: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center' },

  title: { color: colors.text, fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 10, letterSpacing: -0.5 },
  subtitle: { color: colors.textDim, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 28 },

  featureList: { alignSelf: 'stretch', gap: 14 },
  featureRow: { flexDirection: i18n.row(), alignItems: 'center', gap: 10 },
  featureDot: { width: 8, height: 8, borderRadius: 4 },
  featureText: { color: colors.textSecondary, fontSize: 15, fontWeight: '500', flexShrink: 1, textAlign: i18n.textAlign() },

  // Toggle slide
  toggleCard: { alignSelf: 'stretch', flexDirection: i18n.row(), alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  toggleLabel: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1, textAlign: i18n.textAlign() },
  infoRow: { flexDirection: i18n.row(), alignItems: 'flex-start', gap: 8, alignSelf: 'stretch', paddingHorizontal: 4 },
  infoText: { color: colors.textMuted, fontSize: 12, lineHeight: 18, flex: 1, textAlign: i18n.textAlign() },
  legalRow: { marginTop: 16, alignSelf: 'stretch', paddingHorizontal: 4 },
  legalText: { color: colors.textMuted, fontSize: 11, lineHeight: 18, textAlign: 'center' },
  legalLink: { color: colors.green, textDecorationLine: 'underline' },

  bottom: { paddingHorizontal: 24 },
  dots: { flexDirection: i18n.row(), justifyContent: 'center', gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4 },

  btnRow: { flexDirection: i18n.row(), gap: 12 },
  skipBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, alignItems: 'center' },
  skipTxt: { color: colors.textDim, fontSize: 16, fontWeight: '600' },
  nextBtn: { flex: 2, flexDirection: i18n.row(), paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  nextTxt: { color: colors.bg, fontSize: 16, fontWeight: '700' },
});
