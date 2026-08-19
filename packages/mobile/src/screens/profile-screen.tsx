import {
  ALLERGY_SEVERITY_LABELS,
  computeAge,
  CONDITION_STATUS_LABELS,
  formatConditionDate,
  formatProfileDate,
  GENDER_LABELS,
  sortBySeverity,
  useAllergies,
  useAuth,
  useConditions,
  useDoctors,
  useProfile,
  useSupabase,
} from '@nalvita/data';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { DetailRow, EmptyState, SectionCard, StatusBadge } from '@/components/ui';
import { useLock } from '@/lib/lock';
import { useEmergencyFallback } from '@/lib/offline-emergency';
import { radius, spacing, typeScale, useTheme } from '@/lib/theme';

/** Severe allergies are the ones that matter in an emergency, so they read red. */
const SEVERITY_VARIANT = {
  mild: 'normal',
  moderate: 'high',
  severe: 'critical',
} as const;

export function ProfileScreen() {
  const theme = useTheme();
  const supabase = useSupabase();
  const { session } = useAuth();
  const { data: profile } = useProfile(session?.user.id);
  const allergies = useAllergies();
  const conditions = useConditions();
  const doctors = useDoctors();
  const lock = useLock();

  // Allergies are emergency information, so they survive losing signal.
  // Conditions and doctors do not, by design — they are not what anyone needs
  // in an ambulance, and every field kept off the device cannot leak from it.
  const offline = useEmergencyFallback({ allergies: allergies.data });

  const age = computeAge(profile?.date_of_birth ?? null);

  return (
    <Screen title="Profile" subtitle="Your details, and what a doctor would need to know.">
      <SectionCard title="Personal details">
        <DetailRow label="Name" value={profile?.full_name?.trim() || 'Not set'} />
        <DetailRow
          label="Date of birth"
          value={
            profile?.date_of_birth
              ? `${formatProfileDate(profile.date_of_birth)}${age === null ? '' : ` · ${age}`}`
              : 'Not set'
          }
        />
        <DetailRow
          label="Gender"
          value={profile?.gender ? GENDER_LABELS[profile.gender] : 'Not set'}
        />
        <DetailRow label="Blood group" value={profile?.blood_group ?? 'Not set'} />
        <DetailRow label="Signed in as" value={session?.user.email ?? 'Unknown'} />
      </SectionCard>

      <SectionCard title="Allergies">
        {offline.allergiesFromCache ? (
          <Text style={[typeScale.caption, { color: theme.colors.textMuted }]}>
            Saved on this phone, so it is here without a connection.
          </Text>
        ) : null}
        {offline.allergies.length === 0 ? (
          <EmptyState>None recorded.</EmptyState>
        ) : (
          sortBySeverity(offline.allergies).map((allergy) => (
            <View key={allergy.id} style={styles.row}>
              <View style={styles.rowBody}>
                <Text style={[typeScale.body, { color: theme.colors.textPrimary }]}>
                  {allergy.allergen}
                </Text>
                {allergy.reaction ? (
                  <Text style={[typeScale.caption, { color: theme.colors.textMuted }]}>
                    {allergy.reaction}
                  </Text>
                ) : null}
              </View>
              <StatusBadge variant={SEVERITY_VARIANT[allergy.severity]}>
                {ALLERGY_SEVERITY_LABELS[allergy.severity]}
              </StatusBadge>
            </View>
          ))
        )}
      </SectionCard>

      <SectionCard title="Conditions">
        {(conditions.data?.length ?? 0) === 0 ? (
          <EmptyState>None recorded.</EmptyState>
        ) : (
          conditions.data?.map((condition) => (
            <View key={condition.id} style={styles.row}>
              <View style={styles.rowBody}>
                <Text style={[typeScale.body, { color: theme.colors.textPrimary }]}>
                  {condition.name}
                </Text>
                {condition.diagnosis_date ? (
                  <Text style={[typeScale.caption, { color: theme.colors.textMuted }]}>
                    Since {formatConditionDate(condition.diagnosis_date)}
                  </Text>
                ) : null}
              </View>
              <Text style={[typeScale.caption, { color: theme.colors.textSecondary }]}>
                {CONDITION_STATUS_LABELS[condition.status]}
              </Text>
            </View>
          ))
        )}
      </SectionCard>

      <SectionCard title="Doctors">
        {(doctors.data?.length ?? 0) === 0 ? (
          <EmptyState>None recorded.</EmptyState>
        ) : (
          doctors.data?.map((doctor) => (
            <View key={doctor.id} style={styles.rowBody}>
              <Text style={[typeScale.body, { color: theme.colors.textPrimary }]}>
                {doctor.name}
              </Text>
              <Text style={[typeScale.caption, { color: theme.colors.textMuted }]}>
                {[doctor.specialty, doctor.hospital, doctor.phone].filter(Boolean).join(' · ') ||
                  'No details'}
              </Text>
            </View>
          ))
        )}
      </SectionCard>

      <SectionCard title="Security">
        <View style={styles.row}>
          <View style={styles.rowBody}>
            <Text style={[typeScale.body, { color: theme.colors.textPrimary }]}>
              Unlock with Face ID or fingerprint
            </Text>
            <Text style={[typeScale.caption, { color: theme.colors.textMuted }]}>
              {lock.available
                ? 'Locks after five minutes away, so a lost phone is not an open record.'
                : 'Set up a face or fingerprint on this phone to use this.'}
            </Text>
          </View>
          <Switch
            accessibilityLabel="Unlock with Face ID or fingerprint"
            disabled={!lock.available || lock.isLoading}
            value={lock.enabled}
            onValueChange={lock.setEnabled}
            trackColor={{ true: theme.colors.interactiveDefault, false: theme.colors.borderStrong }}
          />
        </View>
      </SectionCard>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void supabase.auth.signOut();
        }}
        style={[
          styles.signOut,
          { backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderStrong },
        ]}
      >
        <Text style={[typeScale.label, { color: theme.colors.textPrimary }]}>Sign out</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowBody: { gap: 2, flexShrink: 1 },
  signOut: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
});
