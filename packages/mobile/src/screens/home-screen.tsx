import {
  activeMedicines,
  formatDocDate,
  formatMeasuredAt,
  formatVitalValue,
  lastCheckupDate,
  latestByVitalType,
  refillDueCount,
  sortBySeverity,
  useAllergies,
  useAuth,
  useDocuments,
  useMedicines,
  useProfile,
  useVitals,
  VITAL_TYPE_LABELS,
  VITAL_UNITS,
} from '@nalvita/data';
import { useRouter } from 'expo-router';
import Activity from 'lucide-react-native/icons/activity';
import FileText from 'lucide-react-native/icons/file-text';
import Pill from 'lucide-react-native/icons/pill';
import Stethoscope from 'lucide-react-native/icons/stethoscope';
import { Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { VitalBadge } from '@/components/vital-badge';
import { AlertBanner, EmptyState, SectionCard, StatCard } from '@/components/ui';
import { spacing, typeScale, useTheme } from '@/lib/theme';

/**
 * The dashboard. Same information as the web one — the four counts, what you
 * are taking, what was filed recently, your latest readings — laid out for a
 * phone rather than mirroring the desktop grid.
 */
export function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();

  const { data: profile } = useProfile(session?.user.id);
  const documents = useDocuments();
  const medicines = useMedicines();
  const vitals = useVitals();
  const allergies = useAllergies();

  const active = activeMedicines(medicines.data ?? []);
  const refillsDue = refillDueCount(medicines.data ?? []);
  const checkup = lastCheckupDate(documents.data ?? []);
  const latest = latestByVitalType(vitals.data ?? []);
  const worstAllergies = sortBySeverity(allergies.data ?? []);

  const greeting = profile?.full_name?.trim() ? `Hello, ${profile.full_name.trim()}` : 'Hello';

  return (
    <Screen title={greeting} subtitle="Your health, in one place.">
      {worstAllergies.length > 0 ? (
        <AlertBanner title="Allergies" onPress={() => router.push('/profile')}>
          {worstAllergies.map((allergy) => allergy.allergen).join(', ')}
        </AlertBanner>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <StatCard
          icon={FileText}
          label="Documents"
          value={String(documents.data?.length ?? 0)}
          isLoading={documents.isPending}
          onPress={() => router.push('/documents')}
        />
        <StatCard
          icon={Pill}
          label="Medicines"
          value={String(active.length)}
          hint={refillsDue > 0 ? `${refillsDue} need a refill` : undefined}
          isLoading={medicines.isPending}
          onPress={() => router.push('/medicines')}
        />
        <StatCard
          icon={Activity}
          label="Readings"
          value={String(vitals.data?.length ?? 0)}
          isLoading={vitals.isPending}
          onPress={() => router.push('/vitals')}
        />
        <StatCard
          icon={Stethoscope}
          label="Last check-up"
          value={checkup ? formatDocDate(checkup) : '—'}
          isLoading={documents.isPending}
        />
      </View>

      <SectionCard title="Medicines you are taking">
        {active.length === 0 ? (
          <EmptyState>Nothing recorded yet.</EmptyState>
        ) : (
          active.slice(0, 4).map((medicine) => (
            <View key={medicine.id} style={{ gap: 2 }}>
              <Text style={[typeScale.body, { color: theme.colors.textPrimary }]}>
                {medicine.name}
              </Text>
              <Text style={[typeScale.caption, { color: theme.colors.textMuted }]}>
                {medicine.dosage}
              </Text>
            </View>
          ))
        )}
      </SectionCard>

      <SectionCard title="Latest readings">
        {latest.length === 0 ? (
          <EmptyState>No readings logged yet.</EmptyState>
        ) : (
          latest.map((vital) => (
            <View
              key={vital.id}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <View style={{ gap: 2, flexShrink: 1 }}>
                <Text style={[typeScale.body, { color: theme.colors.textPrimary }]}>
                  {VITAL_TYPE_LABELS[vital.type]}
                </Text>
                <Text style={[typeScale.caption, { color: theme.colors.textMuted }]}>
                  {formatMeasuredAt(vital.measured_at)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <Text style={[typeScale.body, { color: theme.colors.textPrimary }]}>
                  {formatVitalValue(vital)} {VITAL_UNITS[vital.type]}
                </Text>
                <VitalBadge vital={vital} />
              </View>
            </View>
          ))
        )}
      </SectionCard>

      <SectionCard title="Recent documents">
        {(documents.data?.length ?? 0) === 0 ? (
          <EmptyState>Nothing uploaded yet.</EmptyState>
        ) : (
          documents.data?.slice(0, 4).map((doc) => (
            <View key={doc.id} style={{ gap: 2 }}>
              <Text style={[typeScale.body, { color: theme.colors.textPrimary }]}>{doc.title}</Text>
              <Text style={[typeScale.caption, { color: theme.colors.textMuted }]}>
                {doc.doc_date ? formatDocDate(doc.doc_date) : 'No date'}
              </Text>
            </View>
          ))
        )}
      </SectionCard>
    </Screen>
  );
}
