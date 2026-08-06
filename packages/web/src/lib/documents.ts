import {
  documentInsertSchema,
  documentSchema,
  DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
  type Document,
  type DocumentCategory,
  type DocumentMimeType,
} from '@nalvita/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { auditedInvalidate } from '@/lib/audit';
import { useActiveProfile } from '@/lib/active-profile-context';
import { supabase } from '@/lib/supabase';

const BUCKET = 'health-documents';
/** Signed URLs live for one minute — long enough to open, short enough to stay private. */
const SIGNED_URL_TTL_SECONDS = 60;

const documentListSchema = z.array(documentSchema);

/** User-facing names for each stored category (DB values are snake_case). */
export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  lab_report: 'Lab Report',
  xray_scan: 'X-Ray / Scan',
  prescription: 'Prescription',
  consultation: 'Consultation',
  vaccination: 'Vaccination',
  insurance: 'Insurance',
  other: 'Other',
};

const EXTENSION_BY_MIME: Record<DocumentMimeType, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

/** Reasons an upload can be rejected before it ever reaches Supabase. */
export type UploadRejection = 'unsupported-type' | 'too-large' | 'empty';

export class UploadValidationError extends Error {
  constructor(readonly reason: UploadRejection) {
    super(reason);
    this.name = 'UploadValidationError';
  }
}

function isSupportedType(type: string): type is DocumentMimeType {
  return (DOCUMENT_MIME_TYPES as readonly string[]).includes(type);
}

/** Client-side gate mirroring the bucket's own limits, for a friendly error. */
export function checkUploadFile(file: File): UploadRejection | null {
  if (!isSupportedType(file.type)) return 'unsupported-type';
  if (file.size === 0) return 'empty';
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) return 'too-large';
  return null;
}

/** The fields a person fills in on the upload form (file metadata is derived). */
export interface DocumentFormValues {
  title: string;
  category: DocumentCategory;
  doctor_name: string | null;
  doc_date: string | null;
  notes: string | null;
}

function storagePath(profileId: string, type: DocumentMimeType): string {
  // First path segment names the owning profile — the storage RLS policy
  // resolves it back to a profile and checks access against that.
  return `${profileId}/${crypto.randomUUID()}.${EXTENSION_BY_MIME[type]}`;
}

export function isPdf(document: Pick<Document, 'file_type'>): boolean {
  return document.file_type === 'application/pdf';
}

/** The active profile's documents, newest first. */
export function useDocuments() {
  const { profileId } = useActiveProfile();
  return useQuery({
    queryKey: ['documents', profileId],
    enabled: Boolean(profileId),
    queryFn: async (): Promise<Document[]> => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return documentListSchema.parse(data);
    },
  });
}

/** Uploads the file to the private bucket, then records its metadata row. */
export function useUploadDocument(profileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      values,
    }: {
      file: File;
      values: DocumentFormValues;
    }): Promise<Document> => {
      const rejection = checkUploadFile(file);
      if (rejection) throw new UploadValidationError(rejection);

      const type = file.type as DocumentMimeType;
      const path = storagePath(profileId, type);

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: type, upsert: false });
      if (uploadError) throw uploadError;

      const insert = documentInsertSchema.parse({
        ...values,
        file_path: path,
        file_type: type,
        file_size: file.size,
      });

      const { data, error } = await supabase
        .from('documents')
        .insert({ ...insert, profile_id: profileId })
        .select()
        .single();

      if (error) {
        // Don't leave an orphaned file behind if the row insert fails.
        await supabase.storage.from(BUCKET).remove([path]);
        throw error;
      }
      return documentSchema.parse(data);
    },
    onSuccess: auditedInvalidate(queryClient, 'added', 'documents'),
  });
}

/** Deletes the metadata row and its underlying file. */
export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (document: Document): Promise<Document> => {
      const { error } = await supabase.from('documents').delete().eq('id', document.id);
      if (error) throw error;
      // Row is the source of truth for the list; remove the file best-effort after.
      await supabase.storage.from(BUCKET).remove([document.file_path]);
      return document;
    },
    onSuccess: auditedInvalidate(queryClient, 'deleted', 'documents'),
  });
}

/** A short-lived signed URL for viewing a document inside the app. */
export function useSignedUrl(filePath: string, enabled = true) {
  return useQuery({
    queryKey: ['document-url', filePath],
    enabled,
    // Refetch before the URL expires so the viewer never shows a dead link.
    staleTime: (SIGNED_URL_TTL_SECONDS - 10) * 1000,
    gcTime: (SIGNED_URL_TTL_SECONDS - 10) * 1000,
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

/** Triggers a browser download via a one-off signed URL that forces attachment. */
export async function downloadDocument(document: Document): Promise<void> {
  const fileName = `${document.title}.${EXTENSION_BY_MIME[document.file_type as DocumentMimeType]}`;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(document.file_path, SIGNED_URL_TTL_SECONDS, { download: fileName });
  if (error) throw error;
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}

/** Human-readable file size, e.g. "2.4 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** Formats a YYYY-MM-DD document date for display, parsed as a local date. */
export function formatDocDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
