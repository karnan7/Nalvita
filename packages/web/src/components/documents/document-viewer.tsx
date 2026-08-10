import type { Document } from '@nalvita/core';
import { Download, X } from 'lucide-react';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { auditRecord, isPdf, useDownloadDocument, useSignedUrl, useSupabase } from '@nalvita/data';

interface DocumentViewerProps {
  doc: Document;
  onClose: () => void;
}

function ViewerBody({ doc }: Readonly<{ doc: Document }>) {
  const { data: url, isPending, isError } = useSignedUrl(doc.file_path);

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (isError || !url) {
    return <p className="text-sm text-destructive">We couldn't open this document. Please try again.</p>;
  }
  if (isPdf(doc)) {
    return <iframe title={doc.title} src={url} className="h-full w-full border-0" />;
  }
  return <img src={url} alt={doc.title} className="mx-auto max-h-full max-w-full object-contain" />;
}

export function DocumentViewer({ doc, onClose }: Readonly<DocumentViewerProps>) {
  const supabase = useSupabase();
  const downloadDocument = useDownloadDocument();

  // Opening someone else's document is the action their feed cares about, so it
  // is logged here rather than on the signed-URL fetch (which also refreshes).
  useEffect(() => {
    auditRecord(supabase, 'viewed', 'documents', doc);
  }, [supabase, doc]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="truncate text-lg font-semibold">{doc.title}</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void downloadDocument(doc)}>
            <Download />
            Download
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
        <ViewerBody doc={doc} />
      </div>
    </div>
  );
}
