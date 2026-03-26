// src/screens/OnboardingScreen.js
// 6 промо-слайдов при первом запуске
import { Feather } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Animated, Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import i18n from '../i18n';
import { colors } from '../theme/colors';

const { width: SW } = Dimensions.get('window');

const SLIDES = [
  {
    icon: 'bar-chart-2',
    color: colors.green,
    titleKey: 'onb1Title',
    subKey: 'onb1Sub',
    features: ['onb1f1', 'onb1f2', 'onb1f3'],
  },
  {
    icon: 'cpu',
    color: '#a78bfa',
    titleKey: 'onb2Title',
    subKey: 'onb2Sub',
    features: ['onb2f1', 'onb2f2', 'onb2f3'],
  },
  {
    icon: 'repeat',
    color: colors.blue,
    titleKey: 'onb3Title',
    subKey: 'onb3Sub',
    features: ['onb3f1', 'onb3f2', 'onb3f3'],
  },
  {
    icon: 'camera',
    color: '#fb923c',
    titleKey: 'onb4Title',
    subKey: 'onb4Sub',
    features: ['onb4f1', 'onb4f2', 'onb4f3'],
  },
  {
    icon: 'users',
    color: '#f472b6',
    titleKey: 'onb5Title',
    subKey: 'onb5Sub',
    features: ['onb5f1', 'onb5f2', 'onb5f3'],
  },
  {
    icon: 'trending-up',
    color: '#2dd4bf',
    titleKey: 'onb6Title',
    subKey: 'onb6Sub',
    features: ['onb6f1', 'onb6f2', 'onb6f3'],
  },
];

export default function OnboardingScreen({ onDone }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const onViewRef = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  });
  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 50 });

  const isLast = currentIndex === SLIDES.length - 1;

  const goNext = () => {
    if (isLast) {
      onDone();
    } else {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    }
  };

  const renderSlide = ({ item, index }) => (
    <View style={[st.slide, { width: SW }]}>
      <View style={st.slideContent}>
        {/* Иконка */}
        <View style={[st.iconCircle, { backgroundColor: `${item.color}15` }]}>
          <View style={[st.iconInner, { backgroundColor: `${item.color}25` }]}>
            <Feather name={item.icon} size={48} color={item.color} />
          </View>
        </View>

        {/* Заголовок */}
        <Text style={st.title}>{i18n.t(item.titleKey)}</Text>
        <Text style={st.subtitle}>{i18n.t(item.subKey)}</Text>

        {/* Фичи */}
        <View style={st.featureList}>
          {item.features.map((fk, idx) => (
            <View key={idx} style={st.featureRow}>
              <View style={[st.featureDot, { backgroundColor: item.color }]} />
              <Text style={st.featureText}>{i18n.t(fk)}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <View style={st.container}>
      {/* Лого */}
      <View style={st.logoRow}>
        <Text style={st.logo}><Text style={{ color: colors.green }}>Q</Text>aizo</Text>
      </View>

      {/* Слайды */}
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

      {/* Пагинация + кнопки */}
      <View style={st.bottom}>
        {/* Точки */}
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

        {/* Кнопки */}
        <View style={st.btnRow}>
          <TouchableOpacity style={st.skipBtn} onPress={onDone}>
            <Text style={st.skipTxt}>{i18n.t('skip')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.nextBtn, { backgroundColor: SLIDES[currentIndex].color }]}
            onPress={goNext}
            activeOpacity={0.8}
          >
            <Text style={st.nextTxt}>{isLast ? i18n.t('getStarted') : i18n.t('next')}</Text>
            <Feather name={isLast ? 'check' : 'arrow-right'} size={18} color={colors.bg} style={{ marginStart: 6 }} />
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

  slide: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  slideContent: { alignItems: 'center', paddingHorizontal: 40 },

  iconCircle: { width: 140, height: 140, borderRadius: 70, justifyContent: 'center', alignItems: 'center', marginBottom: 32 },
  iconInner: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center' },

  title: { color: colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 12, letterSpacing: -0.5 },
  subtitle: { color: colors.textDim, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 28 },

  featureList: { alignSelf: 'stretch', gap: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center' },
  featureDot: { width: 6, height: 6, borderRadius: 3, marginEnd: 12 },
  featureText: { color: colors.textSecondary, fontSize: 14, fontWeight: '500', flex: 1 },

  bottom: { paddingHorizontal: 24, paddingBottom: 40 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4 },

  btnRow: { flexDirection: 'row', gap: 12 },
  skipBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, alignItems: 'center' },
  skipTxt: { color: colors.textDim, fontSize: 16, fontWeight: '600' },
  nextBtn: { flex: 2, flexDirection: 'row', paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  nextTxt: { color: colors.bg, fontSize: 16, fontWeight: '700' },
});