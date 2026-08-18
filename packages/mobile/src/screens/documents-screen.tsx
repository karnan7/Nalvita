import type { DocumentCategory } from '@nalvita/core';
import {
  DOCUMENT_CATEGORY_LABELS,
  formatDocDate,
  formatFileSize,
  useDocuments,
  useOpenDocument,
} from '@nalvita/data';
import FileText from 'lucide-react-native/icons/file-text';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/screen';
import { EmptyState } from '@/components/ui';
import { radius, spacing, typeScale, useTheme } from '@/lib/theme';

type Filter = DocumentCategory | 'all';

const FILTERS: Filter[] = ['all', ...(Object.keys(DOCUMENT_CATEGORY_LABELS) as DocumentCategory[])];

export function DocumentsScreen() {
  const theme = useTheme();
  const { data, isPending, isError } = useDocuments();
  const openDocument = useOpenDocument();
  const [filter, setFilter] = useState<Filter>('all');
  const [failed, setFailed] = useState(false);

  const documents = (data ?? []).filter((doc) => filter === 'all' || doc.category === filter);

  return (
    <Screen title="Documents" subtitle="Your reports, prescriptions, and scans.">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((value) => {
          const selected = value === filter;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setFilter(value)}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? theme.colors.interactiveDefault : theme.colors.bgSurface,
                  borderColor: selected ? theme.colors.interactiveDefault : theme.colors.borderStrong,
                },
              ]}
            >
              <Text
                style={[
                  typeScale.label,
                  { color: selected ? theme.colors.textInverse : theme.colors.textSecondary },
                ]}
              >
                {value === 'all' ? 'All' : DOCUMENT_CATEGORY_LABELS[value]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isPending ? <ActivityIndicator color={theme.colors.interactiveDefault} /> : null}

      {isError ? (
        <Text style={[typeScale.body, { color: theme.status.critical.fg }]}>
          We could not load your documents. Pull down to try again.
        </Text>
      ) : null}

      {!isPending && !isError && documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={filter === 'all' ? 'No documents yet' : 'Nothing in this category'}
          description={
            filter === 'all'
              ? 'Reports, prescriptions and scans you add will appear here.'
              : 'Try a different category.'
          }
        />
      ) : null}

      {documents.map((doc) => (
        <Pressable
          key={doc.id}
          accessibilityRole="button"
          accessibilityLabel={`Open ${doc.title}`}
          onPress={() => {
            setFailed(false);
            openDocument(doc).catch(() => setFailed(true));
          }}
          style={[
            styles.card,
            { backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderDefault },
          ]}
        >
          <Text style={[typeScale.body, { color: theme.colors.textPrimary }]}>{doc.title}</Text>
          <Text style={[typeScale.caption, { color: theme.colors.textMuted }]}>
            {[
              DOCUMENT_CATEGORY_LABELS[doc.category],
              doc.doctor_name,
              doc.doc_date ? formatDocDate(doc.doc_date) : null,
              formatFileSize(doc.file_size),
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </Pressable>
      ))}

      {failed ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[typeScale.body, { color: theme.status.critical.fg }]}
        >
          We could not open that document. Please try again.
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { gap: spacing.sm, paddingRight: spacing.md },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
});
