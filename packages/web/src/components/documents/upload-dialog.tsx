import { DOCUMENT_CATEGORIES, type DocumentCategory } from '@nalvita/core';
import { UploadCloud } from 'lucide-react';
import { useId, useRef, useState, type DragEvent, type SyntheticEvent } from 'react';

import { useActiveProfile } from '@/lib/active-profile-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  checkUploadFile,
  DOCUMENT_CATEGORY_LABELS,
  formatFileSize,
  UploadValidationError,
  useUploadDocument,
  type UploadRejection,
} from '@/lib/documents';

const REJECTION_MESSAGES: Record<UploadRejection, string> = {
  'unsupported-type': 'Please choose a PDF, JPG, or PNG file.',
  'too-large': 'That file is larger than 20 MB. Please choose a smaller file.',
  empty: 'That file looks empty. Please choose another file.',
};

function titleFromFileName(name: string): string {
  const withoutExtension = name.replace(/\.[^./\\]+$/, '');
  return withoutExtension.trim() || name;
}

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
}

export function UploadDialog({ open, onClose }: Readonly<UploadDialogProps>) {
  const { userId } = useActiveProfile();
  const upload = useUploadDocument(userId);
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory | ''>('');
  const [doctorName, setDoctorName] = useState('');
  const [docDate, setDocDate] = useState('');
  const [notes, setNotes] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);

  function reset() {
    setFile(null);
    setDragActive(false);
    setTitle('');
    setCategory('');
    setDoctorName('');
    setDocDate('');
    setNotes('');
    setFileError(null);
    upload.reset();
  }

  function close() {
    reset();
    onClose();
  }

  function acceptFile(candidate: File | undefined) {
    if (!candidate) return;
    const rejection = checkUploadFile(candidate);
    if (rejection) {
      setFileError(REJECTION_MESSAGES[rejection]);
      setFile(null);
      return;
    }
    setFileError(null);
    setFile(candidate);
    if (!title) setTitle(titleFromFileName(candidate.name));
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragActive(false);
    acceptFile(event.dataTransfer.files[0]);
  }

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    if (!file || category === '') return;
    upload.mutate(
      {
        file,
        values: {
          title: title.trim(),
          category,
          doctor_name: doctorName.trim() || null,
          doc_date: docDate || null,
          notes: notes.trim() || null,
        },
      },
      { onSuccess: close },
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const submitError =
    upload.isError && !(upload.error instanceof UploadValidationError)
      ? "We couldn't upload your document. Please try again."
      : null;

  return (
    <Modal open={open} onClose={close} title="Upload document">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
              dragActive ? 'border-primary bg-accent' : 'border-input hover:bg-accent'
            }`}
          >
            <UploadCloud className="size-8 text-muted-foreground" />
            {file ? (
              <span className="text-sm font-medium">
                {file.name} <span className="text-muted-foreground">({formatFileSize(file.size)})</span>
              </span>
            ) : (
              <>
                <span className="text-sm font-medium">Drag a file here, or click to choose</span>
                <span className="text-xs text-muted-foreground">PDF, JPG, or PNG · up to 20 MB</span>
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            id={fileInputId}
            type="file"
            aria-label="Choose file"
            accept="application/pdf,image/jpeg,image/png"
            className="sr-only"
            onChange={(event) => acceptFile(event.target.files?.[0])}
          />
        </div>
        {fileError && <p className="text-sm text-destructive">{fileError}</p>}

        <div className="flex flex-col gap-2">
          <Label htmlFor="doc-title">Title</Label>
          <Input
            id="doc-title"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="doc-category">Category</Label>
          <Select
            id="doc-category"
            required
            value={category}
            onChange={(event) => setCategory(event.target.value as DocumentCategory | '')}
          >
            <option value="" disabled>
              Choose a category
            </option>
            {DOCUMENT_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {DOCUMENT_CATEGORY_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="doc-doctor">Doctor or lab (optional)</Label>
          <Input
            id="doc-doctor"
            value={doctorName}
            onChange={(event) => setDoctorName(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="doc-date">Document date (optional)</Label>
          <Input
            id="doc-date"
            type="date"
            max={today}
            value={docDate}
            onChange={(event) => setDocDate(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="doc-notes">Notes (optional)</Label>
          <Textarea
            id="doc-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        {submitError && <p className="text-sm text-destructive">{submitError}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={!file || category === '' || upload.isPending}>
            {upload.isPending ? 'Uploading…' : 'Upload'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
