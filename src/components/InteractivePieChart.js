// src/components/InteractivePieChart.js
// Interactive SVG pie chart with tap-to-select segments
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { G, Path, Circle } from 'react-native-svg';
import { colors } from '../theme/colors';
import { sym } from '../utils/currency';

const AnimatedPath = Animated.createAnimatedComponent(Path);

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

export default function InteractivePieChart({ data, size = 220, donut = true }) {
  const [selected, setSelected] = useState(null);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const total = data.reduce((s, d) => s + d.amount, 0);

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
  }, []);

  if (data.length === 0 || total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8; // padding for selected scale
  const innerR = donut ? r * 0.55 : 0;

  // Build slices
  let currentAngle = 0;
  const slices = data.map((item, idx) => {
    const pct = item.amount / total;
    const angle = pct * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    // Midpoint for label positioning
    const midAngle = startAngle + angle / 2;
    const labelR = r * 0.75;
    const mid = polarToCartesian(cx, cy, labelR, midAngle);

    return { ...item, startAngle, endAngle, pct, mid, idx };
  });

  const selectedItem = selected !== null ? slices[selected] : null;

  const handlePress = (idx) => {
    setSelected(selected === idx ? null : idx);
  };

  return (
    <View style={st.container}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {slices.map((slice) => {
            const isSelected = selected === slice.idx;
            // Slightly push out selected slice
            let offsetX = 0, offsetY = 0;
            if (isSelected) {
              const midRad = ((slice.startAngle + (slice.endAngle - slice.startAngle) / 2) - 90) * Math.PI / 180;
              offsetX = 6 * Math.cos(midRad);
              offsetY = 6 * Math.sin(midRad);
            }

            if (donut) {
              // Donut arc (outer - inner)
              const outerStart = polarToCartesian(cx + offsetX, cy + offsetY, r, slice.endAngle);
              const outerEnd = polarToCartesian(cx + offsetX, cy + offsetY, r, slice.startAngle);
              const innerStart = polarToCartesian(cx + offsetX, cy + offsetY, innerR, slice.startAngle);
              const innerEnd = polarToCartesian(cx + offsetX, cy + offsetY, innerR, slice.endAngle);
              const largeArc = slice.endAngle - slice.startAngle > 180 ? 1 : 0;
              const d = [
                `M ${outerStart.x} ${outerStart.y}`,
                `A ${r} ${r} 0 ${largeArc} 0 ${outerEnd.x} ${outerEnd.y}`,
                `L ${innerStart.x} ${innerStart.y}`,
                `A ${innerR} ${innerR} 0 ${largeArc} 1 ${innerEnd.x} ${innerEnd.y}`,
                'Z',
              ].join(' ');
              return (
                <Path
                  key={slice.idx}
                  d={d}
                  fill={slice.color}
                  opacity={selected !== null && !isSelected ? 0.4 : 1}
                  onPress={() => handlePress(slice.idx)}
                  stroke={isSelected ? colors.text : 'transparent'}
                  strokeWidth={isSelected ? 2 : 0}
                />
              );
            }

            // Full pie slice
            const d = arcPath(cx + offsetX, cy + offsetY, r, slice.startAngle, slice.endAngle);
            return (
              <Path
                key={slice.idx}
                d={d}
                fill={slice.color}
                opacity={selected !== null && !isSelected ? 0.4 : 1}
                onPress={() => handlePress(slice.idx)}
                stroke={isSelected ? colors.text : 'transparent'}
                strokeWidth={isSelected ? 2 : 0}
              />
            );
          })}
        </Svg>

        {/* Center label for donut */}
        {donut && (
          <View style={[st.centerLabel, { width: size, height: size }]} pointerEvents="none">
            {selectedItem ? (
              <>
                <Text style={st.centerAmount}>{sym()}{selectedItem.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
                <Text style={st.centerPct}>{Math.round(selectedItem.pct * 100)}%</Text>
              </>
            ) : (
              <>
                <Text style={st.centerAmount}>{sym()}{total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
              </>
            )}
          </View>
        )}
      </Animated.View>

      {/* Legend */}
      <View style={st.legend}>
        {slices.map((slice) => {
          const isSelected = selected === slice.idx;
          return (
            <TouchableOpacity
              key={slice.idx}
              style={[st.legendRow, isSelected && st.legendRowActive]}
              onPress={() => handlePress(slice.idx)}
              activeOpacity={0.7}
            >
              <View style={[st.legendDot, { backgroundColor: slice.color }]} />
              <Text style={[st.legendName, isSelected && st.legendNameActive]} numberOfLines={1}>
                {slice.name}
              </Text>
              <Text style={[st.legendAmount, isSelected && st.legendAmountActive]}>
                {sym()}{slice.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </Text>
              <Text style={st.legendPct}>{Math.round(slice.pct * 100)}%</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container: { alignItems: 'center' },
  centerLabel: { position: 'absolute', top: 0, left: 0, justifyContent: 'center', alignItems: 'center' },
  centerAmount: { color: colors.text, fontSize: 18, fontWeight: '800' },
  centerPct: { color: colors.textDim, fontSize: 13, fontWeight: '600', marginTop: 2 },

  legend: { width: '100%', marginTop: 16, gap: 2 },
  legendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 8, borderRadius: 10 },
  legendRowActive: { backgroundColor: colors.bg2 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginEnd: 10 },
  legendName: { flex: 1, color: colors.textDim, fontSize: 13, fontWeight: '600' },
  legendNameActive: { color: colors.text },
  legendAmount: { color: colors.textDim, fontSize: 13, fontWeight: '700', marginEnd: 8 },
  legendAmountActive: { color: colors.text },
  legendPct: { color: colors.textMuted, fontSize: 12, fontWeight: '600', minWidth: 32, textAlign: 'right' },
});
