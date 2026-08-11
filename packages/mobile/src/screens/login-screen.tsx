import { useSupabase } from '@nalvita/data';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { sendEmailCode, signInWithGoogle, verifyEmailCode } from '@/lib/auth';
import { radius, spacing, typeScale, useTheme } from '@/lib/theme';

type Step = 'email' | 'code';

export function LoginScreen() {
  const theme = useTheme();
  const supabase = useSupabase();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withBusy(work: () => Promise<string | null>, onDone?: () => void) {
    setBusy(true);
    setError(null);
    const failure = await work();
    setBusy(false);
    if (failure) {
      setError(failure);
      return;
    }
    onDone?.();
  }

  const inputStyle = {
    backgroundColor: theme.colors.bgSurface,
    borderColor: theme.colors.borderStrong,
    color: theme.colors.textPrimary,
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bgApp }]}>
      <View style={styles.header}>
        <Text style={[typeScale.heading1, { color: theme.colors.textPrimary }]}>Nalvita</Text>
        <Text style={[typeScale.body, styles.centred, { color: theme.colors.textSecondary }]}>
          Your health records, in one place. Sign in with your email — no password to remember.
        </Text>
      </View>

      {step === 'email' ? (
        <View style={styles.form}>
          <Text style={[typeScale.label, { color: theme.colors.textSecondary }]}>
            Email address
          </Text>
          <TextInput
            style={[styles.input, inputStyle]}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            editable={!busy}
            accessibilityLabel="Email address"
          />
          <PrimaryButton
            label="Email me a code"
            busy={busy}
            disabled={!email.includes('@')}
            onPress={() =>
              void withBusy(
                () => sendEmailCode(supabase, email),
                () => setStep('code'),
              )
            }
          />
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={[typeScale.label, { color: theme.colors.textSecondary }]}>
            Enter the 6-digit code we sent to {email}
          </Text>
          <TextInput
            style={[styles.input, styles.code, inputStyle]}
            value={code}
            onChangeText={setCode}
            placeholder="000000"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={6}
            autoComplete="one-time-code"
            editable={!busy}
            accessibilityLabel="Six digit code"
          />
          <PrimaryButton
            label="Sign in"
            busy={busy}
            disabled={code.trim().length < 6}
            onPress={() => void withBusy(() => verifyEmailCode(supabase, email, code))}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setStep('email');
              setCode('');
              setError(null);
            }}
          >
            <Text style={[typeScale.label, styles.centred, { color: theme.colors.interactiveDefault }]}>
              Use a different email
            </Text>
          </Pressable>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void withBusy(() => signInWithGoogle(supabase))}
        style={[
          styles.secondary,
          { backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderStrong },
        ]}
      >
        <Text style={[typeScale.label, { color: theme.colors.textPrimary }]}>
          Continue with Google
        </Text>
      </Pressable>

      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[typeScale.body, styles.centred, { color: theme.status.critical.fg }]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function PrimaryButton({
  label,
  busy,
  disabled,
  onPress,
}: Readonly<{ label: string; busy: boolean; disabled: boolean; onPress: () => void }>) {
  const theme = useTheme();
  const inactive = busy || disabled;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={[
        styles.primary,
        {
          backgroundColor: inactive
            ? theme.colors.interactiveDisabled
            : theme.colors.interactiveDefault,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={theme.colors.textInverse} />
      ) : (
        <Text style={[typeScale.label, { color: theme.colors.textInverse }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.lg },
  header: { alignItems: 'center', gap: spacing.sm },
  centred: { textAlign: 'center' },
  form: { gap: spacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
  },
  code: { textAlign: 'center', fontSize: 24, letterSpacing: 8 },
  primary: {
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  secondary: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
});
