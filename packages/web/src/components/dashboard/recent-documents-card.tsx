import type { DocumentCategory } from '@nalvita/core';
import {
  File,
  FlaskConical,
  Pill,
  ScanLine,
  ShieldCheck,
  Stethoscope,
  Syringe,
  type LucideIcon,
} from 'lucide-react';

import { CardSkeleton, EmptyState, SectionCard } from '@/components/ui-nalvita';
import { DOCUMENT_CATEGORY_LABELS, formatDocDate, useDocuments } from '@/lib/documents';

const CATEGORY_ICONS: Record<DocumentCategory, LucideIcon> = {
  lab_report: FlaskConical,
  xray_scan: ScanLine,
  prescription: Pill,
  consultation: Stethoscope,
  vaccination: Syringe,
  insurance: ShieldCheck,
  other: File,
};

export function RecentDocumentsCard() {
  const { data: documents, isPending, isError } = useDocuments();
  const recent = (documents ?? []).slice(0, 4);

  return (
    <SectionCard title="Recent documents" seeAllTo="/documents">
      {isPending && <CardSkeleton />}
      {isError && <EmptyState>We couldn't load your documents.</EmptyState>}
      {!isPending && !isError && recent.length === 0 && (
        <EmptyState>Upload your first document to keep your reports in one place.</EmptyState>
      )}
      {recent.length > 0 && (
        <ul className="flex flex-col gap-2">
          {recent.map((doc) => {
            const Icon = CATEGORY_ICONS[doc.category];
            return (
              <li key={doc.id} className="flex items-center gap-3">
                <Icon className="size-4 shrink-0 text-content-muted" />
                <span className="min-w-0 flex-1 truncate text-sm">{doc.title}</span>
                <span className="shrink-0 text-xs text-content-muted">
                  {doc.doc_date ? formatDocDate(doc.doc_date) : DOCUMENT_CATEGORY_LABELS[doc.category]}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
