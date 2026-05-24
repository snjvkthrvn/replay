import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Image, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../constants/theme';

function hash01(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return (hash % 1000) / 1000;
}

function seededColor(seed: string, fallback = colors.accent) {
  if (!seed) return fallback;
  const palette = ['#8B3A2A', '#2A4A6B', '#5A3A22', '#3D5A3E', '#4A2060', '#1A1A1A'];
  return palette[Math.floor(hash01(seed) * palette.length)] || fallback;
}

interface AlbumArtProps {
  url?: string | null;
  seed?: string;
  color?: string;
  size?: ViewStyle['width'];
  borderRadius?: number;
  style?: ViewStyle;
  circular?: boolean;
}

export function AlbumArt({
  url,
  seed = '',
  color,
  size = 64,
  borderRadius = radius.md,
  style,
  circular,
}: AlbumArtProps) {
  const baseColor = color || seededColor(seed);
  const h = hash01(seed || baseColor);
  const variant = Math.floor(h * 4);
  const resolvedRadius = circular ? 999 : borderRadius;

  const frameStyle = [
    styles.albumFrame,
    { width: size, height: size, borderRadius: resolvedRadius },
    style,
  ];

  if (url) {
    return (
      <View style={[frameStyle, styles.imageFrame]}>
        <Image source={{ uri: url }} style={styles.imageFill} />
      </View>
    );
  }

  return (
    <View style={frameStyle}>
      <LinearGradient
        colors={[baseColor, `${baseColor}AA`, '#08080A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.albumShade} />

      {variant === 0 && (
        <>
          <View style={[styles.splitLine, { top: `${34 + h * 22}%` }]} />
          <View style={[styles.thinLine, { top: `${43 + h * 18}%`, width: '58%' }]} />
        </>
      )}
      {variant === 1 && (
        <View style={styles.barMotif}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[
                styles.verticalBar,
                {
                  height: 28 + ((i * 11 + Math.floor(h * 20)) % 34),
                  opacity: 0.34 + i * 0.06,
                },
              ]}
            />
          ))}
        </View>
      )}
      {variant === 2 && (
        <>
          <View
            style={[
              styles.ringMotif,
              {
                width: '66%',
                height: '66%',
                left: `${8 + h * 24}%`,
                top: `${7 + h * 24}%`,
              },
            ]}
          />
          <View style={[styles.dotMotif, { left: `${29 + h * 35}%`, top: `${28 + h * 35}%` }]} />
        </>
      )}
      {variant === 3 && (
        <>
          <View style={[styles.diagonalMotif, { transform: [{ rotate: `${-28 + h * 24}deg` }] }]} />
          <View style={[styles.squareMotif, { left: `${22 + h * 28}%`, top: `${24 + h * 24}%` }]} />
        </>
      )}

      <View style={styles.noteMark}>
        <Ionicons name="musical-note" size={16} color="rgba(255,255,255,0.72)" />
      </View>
    </View>
  );
}

interface WaveformBarsProps {
  color?: string;
  active?: boolean;
  count?: number;
  height?: number;
}

export function WaveformBars({
  color = colors.accent,
  active = true,
  count = 12,
  height = 20,
}: WaveformBarsProps) {
  const values = useMemo(
    () => Array.from({ length: count }, (_, i) => new Animated.Value(0.22 + (i % 4) * 0.12)),
    [count]
  );

  useEffect(() => {
    if (!active) return undefined;
    const loops = values.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 0.95,
            duration: 420 + (i % 4) * 90,
            delay: i * 28,
            useNativeDriver: false,
          }),
          Animated.timing(value, {
            toValue: 0.24,
            duration: 460 + (i % 3) * 80,
            useNativeDriver: false,
          }),
        ])
      )
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [active, values]);

  return (
    <View style={[styles.waveform, { height }]}>
      {values.map((value, i) => (
        <Animated.View
          key={i}
          style={[
            styles.waveBar,
            {
              backgroundColor: color,
              opacity: active ? 0.95 : 0.34,
              height: value.interpolate({
                inputRange: [0, 1],
                outputRange: [4, height],
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  albumFrame: {
    overflow: 'hidden',
    backgroundColor: colors.surface,
    position: 'relative',
  },
  imageFrame: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
  },
  imageFill: {
    width: '100%',
    height: '100%',
  },
  albumShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  splitLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  thinLine: {
    position: 'absolute',
    left: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  barMotif: {
    position: 'absolute',
    left: '18%',
    right: '18%',
    bottom: '18%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  verticalBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  ringMotif: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.34)',
  },
  dotMotif: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  diagonalMotif: {
    position: 'absolute',
    left: '-12%',
    right: '-12%',
    top: '48%',
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.36)',
  },
  squareMotif: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  noteMark: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    opacity: 0.75,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },
});
