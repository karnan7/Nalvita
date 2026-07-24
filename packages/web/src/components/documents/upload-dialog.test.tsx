import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UploadDialog } from './upload-dialog';
import { supabase } from '@/lib/supabase';
import { makeDocumentRow, makeSession } from '@/test/mocks/supabase';
import { renderWithProviders } from '@/test/render';

const USER_ID = '00000000-0000-4000-8000-000000000001';

beforeEach(() => {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: makeSession() },
    error: null,
  } as never);
});

describe('UploadDialog', () => {
  it('rejects a file that is not a PDF, JPG, or PNG', async () => {
    renderWithProviders(<UploadDialog open onClose={() => {}} />);

    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    // fireEvent.change bypasses the browser's own `accept` filter so the bad
    // file reaches our handler and we can assert our own rejection message.
    fireEvent.change(await screen.findByLabelText('Choose file'), { target: { files: [file] } });

    expect(await screen.findByText(/please choose a pdf, jpg, or png file/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
  });

  it('uploads the file to the private bucket then records its metadata', async () => {
    const upload = vi.fn(async () => ({ data: { path: 'p' }, error: null }));
    const remove = vi.fn(async () => ({ data: [], error: null }));
    vi.mocked(supabase.storage.from).mockReturnValue({ upload, remove } as never);

    const single = vi.fn(async () => ({ data: makeDocumentRow(), error: null }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    vi.mocked(supabase.from).mockReturnValue({ insert } as never);

    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<UploadDialog open onClose={onClose} />);

    const file = new File(['%PDF-1.4 fake'], 'report.pdf', { type: 'application/pdf' });
    await user.upload(await screen.findByLabelText('Choose file'), file);
    // Title auto-fills from the file name.
    expect(screen.getByLabelText('Title')).toHaveValue('report');
    await user.selectOptions(screen.getByLabelText('Category'), 'lab_report');
    await user.type(screen.getByLabelText('Doctor or lab (optional)'), 'City Lab');
    await user.click(screen.getByRole('button', { name: 'Upload' }));

    await waitFor(() => expect(insert).toHaveBeenCalled());

    const firstCall = upload.mock.calls[0] as unknown[] | undefined;
    const uploadedPath = (firstCall?.[0] as string | undefined) ?? '';
    expect(uploadedPath.startsWith(`${USER_ID}/`)).toBe(true);
    expect(uploadedPath.endsWith('.pdf')).toBe(true);

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_ID,
        title: 'report',
        category: 'lab_report',
        doctor_name: 'City Lab',
        doc_date: null,
        notes: null,
        file_type: 'application/pdf',
        file_size: file.size,
      }),
    );
    expect(remove).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
