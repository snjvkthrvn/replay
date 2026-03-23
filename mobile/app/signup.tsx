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
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, typography, gradients } from '../constants/theme';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const router = useRouter();

  const handleSignup = async () => {
    setError('');
    setLoading(true);
    try {
      await signup({ email, username, password, displayName });
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.glowOrb} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandingSection}>
            <Text style={styles.title}>Join Replay</Text>
            <Text style={styles.subtitle}>Share what you're really listening to</Text>
          </View>

          <View style={styles.formSection}>
            {[
              { label: 'EMAIL', value: email, setter: setEmail, placeholder: 'you@email.com', kb: 'email-address' as const },
              { label: 'USERNAME', value: username, setter: setUsername, placeholder: 'Pick a username' },
              { label: 'DISPLAY NAME', value: displayName, setter: setDisplayName, placeholder: 'What should we call you?' },
              { label: 'PASSWORD', value: password, setter: setPassword, placeholder: 'Min 8 characters', secure: true },
            ].map((field) => (
              <View key={field.label} style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>{field.label}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={field.placeholder}
                  placeholderTextColor={colors.textTertiary}
                  value={field.value}
                  onChangeText={field.setter}
                  autoCapitalize="none"
                  keyboardType={field.kb || 'default'}
                  secureTextEntry={field.secure}
                />
              </View>
            ))}

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={handleSignup}
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
                  <Text style={styles.buttonText}>Create Account</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.back()} style={styles.linkButton}>
              <Text style={styles.linkText}>
                Already on Replay? <Text style={styles.linkAccent}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
    top: -100,
    left: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.accentGlow,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.huge,
  },
  brandingSection: {
    marginBottom: spacing.huge,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  formSection: {},
  inputWrapper: {
    marginBottom: spacing.lg,
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
