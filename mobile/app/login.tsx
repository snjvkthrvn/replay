import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, typography, gradients } from '../constants/theme';
import { WaveformBars } from '../components/ReplayVisuals';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.glowOrb} />
      <View style={styles.glowOrbSecondary} />
      <View style={styles.scanline} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.brandingSection}>
          <View style={styles.logoBars}>
            {[16, 22, 14, 20, 18, 12, 24, 10].map((height, i) => (
              <View key={i} style={[styles.logoBar, { height }]} />
            ))}
          </View>
          <Text style={styles.logo}>replay</Text>
          <Text style={styles.tagline}>your music, unfiltered</Text>
        </View>

        <View style={styles.formSection}>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="you@email.com"
              placeholderTextColor={colors.textTertiary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>PASSWORD</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter password"
                placeholderTextColor={colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textTertiary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
            style={styles.buttonOuter}
          >
            <LinearGradient
              colors={gradients.accentButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.button}
            >
              {loading ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/signup')}
            style={styles.linkButton}
          >
            <Text style={styles.linkText}>
              New here? <Text style={styles.linkAccent}>Create account</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.captureRhythm}>
          <WaveformBars color={colors.accent} active count={16} height={18} />
          <Text style={styles.captureRhythmText}>CAPTURES 4x DAILY</Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  glowOrb: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.accentGlow,
  },
  glowOrbSecondary: {
    position: 'absolute',
    bottom: 80,
    left: -90,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.accentGlow,
    opacity: 0.6,
  },
  scanline: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '18%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(200,149,108,0.25)',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
  },
  brandingSection: {
    marginBottom: spacing.massive,
  },
  logoBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 26,
    marginBottom: spacing.md,
  },
  logoBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  logo: {
    ...typography.hero,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  tagline: {
    ...typography.body,
    color: colors.textSecondary,
  },
  formSection: {},
  inputWrapper: {
    marginBottom: spacing.xl,
  },
  inputLabel: {
    ...typography.micro,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    borderRadius: radius.md,
    fontSize: 16,
    color: colors.text,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
  },
  passwordInput: {
    flex: 1,
    padding: spacing.lg,
    fontSize: 16,
    color: colors.text,
  },
  eyeButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  errorContainer: {
    backgroundColor: colors.missedBg,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.lg,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  buttonOuter: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  button: {
    padding: spacing.lg + 2,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  buttonText: {
    color: colors.bg,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  linkButton: {
    marginTop: spacing.xxl,
    alignItems: 'center',
  },
  linkText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  linkAccent: {
    color: colors.accent,
    fontWeight: '600',
  },
  captureRhythm: {
    alignItems: 'center',
    marginTop: spacing.massive,
    opacity: 0.62,
  },
  captureRhythmText: {
    marginTop: spacing.sm,
    color: colors.textTertiary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
