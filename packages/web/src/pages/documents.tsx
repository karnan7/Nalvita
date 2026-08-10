import { DOCUMENT_CATEGORIES, type Document, type DocumentCategory } from '@nalvita/core';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { DocumentCard } from '@/components/documents/document-card';
import { DocumentViewer } from '@/components/documents/document-viewer';
import { UploadDialog } from '@/components/documents/upload-dialog';
import { Button } from '@/components/ui/button';
import { DOCUMENT_CATEGORY_LABELS, useDocuments, useRecordPermissions } from '@nalvita/data';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type CategoryFilter = DocumentCategory | 'all';

function matchesSearch(doc: Document, query: string): boolean {
  const haystack = `${doc.title} ${doc.doctor_name ?? ''}`.toLowerCase();
  return haystack.includes(query);
}

function FilterChips({
  selected,
  onSelect,
}: Readonly<{ selected: CategoryFilter; onSelect: (value: CategoryFilter) => void }>) {
  const chips: { value: CategoryFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    ...DOCUMENT_CATEGORIES.map((value) => ({ value, label: DOCUMENT_CATEGORY_LABELS[value] })),
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <button
          key={chip.value}
          type="button"
          onClick={() => onSelect(chip.value)}
          className={cn(
            'rounded-full border px-3 py-1 text-sm transition-colors',
            selected === chip.value
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-input hover:bg-accent',
          )}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}

export default function DocumentsPage() {
  const { data: documents, isPending, isError } = useDocuments();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewing, setViewing] = useState<Document | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');

  const { canWrite, canDelete, guardWrite } = useRecordPermissions();

  const filtered = useMemo(() => {
    if (!documents) return [];
    const query = search.trim().toLowerCase();
    return documents.filter(
      (doc) =>
        (category === 'all' || doc.category === category) &&
        (query === '' || matchesSearch(doc, query)),
    );
  }, [documents, search, category]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
        {canWrite && (
          <Button onClick={() => guardWrite(() => setUploadOpen(true))}>
            <Plus />
            Upload document
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <Input
          type="search"
          placeholder="Search by name or doctor/lab"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <FilterChips selected={category} onSelect={setCategory} />
      </div>

      {isPending && <p className="text-sm text-muted-foreground">Loading your documents…</p>}
      {isError && (
        <p className="text-sm text-destructive">
          We couldn't load your documents. Please refresh the page.
        </p>
      )}

      {!isPending && !isError && documents.length === 0 && (
        <p className="text-muted-foreground">
          No documents yet. Upload your first report, prescription, or scan to get started.
        </p>
      )}

      {!isPending && !isError && documents.length > 0 && filtered.length === 0 && (
        <p className="text-muted-foreground">No documents match your search.</p>
      )}

      {filtered.length > 0 && (
        <ul className="flex flex-col gap-3">
          {filtered.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} onView={setViewing} canDelete={canDelete} />
          ))}
        </ul>
      )}

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
      {viewing && <DocumentViewer doc={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
