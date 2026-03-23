export const colors = {
  // Backgrounds
  bg: '#08080A',
  surface: '#111114',
  card: '#16161A',
  cardElevated: '#1C1C21',
  cardBorder: '#222228',

  // Accent — warm copper/amber
  accent: '#C8956C',
  accentLight: '#E2B687',
  accentMuted: '#A07A58',
  accentGlow: 'rgba(200, 149, 108, 0.12)',
  accentGlowStrong: 'rgba(200, 149, 108, 0.3)',

  // Spotify
  spotify: '#1DB954',
  spotifyDim: 'rgba(29, 185, 84, 0.12)',

  // Text
  text: '#EEECEA',
  textSecondary: '#858380',
  textTertiary: '#4E4D4A',

  // Status
  confirmed: '#5CB870',
  confirmedBg: 'rgba(92, 184, 112, 0.12)',
  late: '#D4A04A',
  lateBg: 'rgba(212, 160, 74, 0.12)',
  silent: '#6B6B6B',
  silentBg: 'rgba(107, 107, 107, 0.12)',
  missed: '#D45050',
  missedBg: 'rgba(212, 80, 80, 0.12)',
  error: '#D45050',
  warning: '#D4A04A',
  warningBg: 'rgba(212, 160, 74, 0.10)',

  // Dividers
  divider: '#1A1A1F',
  dividerLight: '#141418',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.4)',
};

export const gradients = {
  accentButton: ['#C8956C', '#B07A52'] as const,
  accentButtonPressed: ['#B07A52', '#8F6443'] as const,
  headerFade: ['rgba(8,8,10,1)', 'rgba(8,8,10,0)'] as const,
  cardShine: ['rgba(255,255,255,0.03)', 'rgba(255,255,255,0)'] as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  massive: 64,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
};

export const typography = {
  hero: {
    fontSize: 42,
    fontWeight: '800' as const,
    letterSpacing: -1.5,
    color: colors.text,
  },
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.8,
    color: colors.text,
  },
  h2: {
    fontSize: 22,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    color: colors.text,
  },
  h3: {
    fontSize: 17,
    fontWeight: '600' as const,
    letterSpacing: -0.3,
    color: colors.text,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    letterSpacing: -0.1,
    color: colors.text,
  },
  bodyBold: {
    fontSize: 15,
    fontWeight: '600' as const,
    letterSpacing: -0.1,
    color: colors.text,
  },
  caption: {
    fontSize: 13,
    fontWeight: '500' as const,
    letterSpacing: 0,
    color: colors.textSecondary,
  },
  micro: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.8,
    color: colors.textTertiary,
  },
};
