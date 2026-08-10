import type { Document } from '@nalvita/core';
import { Download, Eye, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import {
  DOCUMENT_CATEGORY_LABELS,
  formatDocDate,
  formatFileSize,
  useDeleteDocument,
  useDownloadDocument,
} from '@nalvita/data';

interface DocumentCardProps {
  doc: Document;
  onView: (doc: Document) => void;
  /** False when the current role may not remove this person's documents. */
  canDelete?: boolean;
}

export function DocumentCard({ doc, onView, canDelete = true }: Readonly<DocumentCardProps>) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteDocument = useDeleteDocument();
  const downloadDocument = useDownloadDocument();

  function confirmDelete() {
    deleteDocument.mutate(doc, { onSuccess: () => setConfirmingDelete(false) });
  }

  const meta = [
    DOCUMENT_CATEGORY_LABELS[doc.category],
    doc.doctor_name,
    doc.doc_date ? formatDocDate(doc.doc_date) : null,
    formatFileSize(doc.file_size),
  ].filter(Boolean);

  return (
    <li className="flex flex-col gap-3 rounded-lg border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-medium">{doc.title}</p>
        <p className="text-sm text-muted-foreground">{meta.join(' · ')}</p>
        {doc.notes && <p className="mt-1 truncate text-sm text-muted-foreground">{doc.notes}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" size="sm" onClick={() => onView(doc)}>
          <Eye />
          View
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-label={`Download ${doc.title}`}
          onClick={() => void downloadDocument(doc)}
        >
          <Download />
        </Button>
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Delete ${doc.title}`}
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 className="text-destructive" />
          </Button>
        )}
      </div>

      <Modal
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Delete document?"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{doc.title}</span> will be permanently
            removed. This cannot be undone.
          </p>
          {deleteDocument.isError && (
            <p className="text-sm text-destructive">We couldn't delete it. Please try again.</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleteDocument.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteDocument.isPending}
            >
              {deleteDocument.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </li>
  );
}
