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
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, typography, gradients } from '../constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      {/* Decorative glow */}
      <View style={styles.glowOrb} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.brandingSection}>
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
            <TextInput
              style={styles.input}
              placeholder="Enter password"
              placeholderTextColor={colors.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
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
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
  },
  brandingSection: {
    marginBottom: spacing.massive,
  },
  logo: {
    ...typography.hero,
    color: colors.accent,
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
});
