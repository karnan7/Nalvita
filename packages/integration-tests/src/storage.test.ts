import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  admin,
  createTestUser,
  deleteTestUsers,
  supabaseUrl,
  type TestUser,
} from './helpers/clients.js';
import { createActiveMembership } from './helpers/memberships.js';

/**
 * The private health-documents bucket: uploads only under one's own
 * <uid>/ prefix, no public access, downloads only via short-lived signed
 * URLs, and the 20 MB / MIME limits enforced by the bucket itself.
 */

const BUCKET = 'health-documents';
const PDF_BYTES = new TextEncoder().encode('%PDF-1.4 fake test document');

let owner: TestUser;
let outsider: TestUser;
let docsViewer: TestUser; // active circle member shared on documents
let ownerPath: string;

function upload(user: TestUser, path: string, bytes: Uint8Array, contentType: string) {
  return user.client.storage.from(BUCKET).upload(path, bytes, { contentType });
}

beforeAll(async () => {
  owner = await createTestUser('storage-owner');
  outsider = await createTestUser('storage-outsider');
  docsViewer = await createTestUser('storage-docs-viewer');
  await createActiveMembership(owner, docsViewer, 'viewer', ['documents']);

  ownerPath = `${owner.id}/report.pdf`;
});

afterAll(async () => {
  // Storage objects do not cascade with user deletion.
  await admin.storage.from(BUCKET).remove([ownerPath, `${owner.id}/evil.pdf`]);
  await deleteTestUsers(owner, outsider, docsViewer);
});

describe('uploads', () => {
  it('owner can upload under their own prefix', async () => {
    const { error } = await upload(owner, ownerPath, PDF_BYTES, 'application/pdf');
    expect(error).toBeNull();
  });

  it("nobody can upload under another user's prefix", async () => {
    const { error } = await upload(
      outsider,
      `${owner.id}/evil.pdf`,
      PDF_BYTES,
      'application/pdf',
    );
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/row-level security|unauthorized/i);
  });

  it('rejects disallowed MIME types', async () => {
    const { error } = await upload(
      owner,
      `${owner.id}/notes.txt`,
      PDF_BYTES,
      'text/plain',
    );
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/mime/i);
  });

  it('rejects files over the 20 MB limit', async () => {
    const oversized = new Uint8Array(20 * 1024 * 1024 + 1);
    const { error } = await upload(owner, `${owner.id}/huge.pdf`, oversized, 'application/pdf');
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/exceeded|size/i);
  });
});

describe('reads', () => {
  it('the bucket has no public URLs', async () => {
    const res = await fetch(`${supabaseUrl}/storage/v1/object/public/${BUCKET}/${ownerPath}`);
    expect(res.ok).toBe(false);
  });

  it('unauthenticated direct object access fails', async () => {
    const res = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${ownerPath}`);
    expect(res.ok).toBe(false);
  });

  it('the owner can download their own file', async () => {
    const { data, error } = await owner.client.storage.from(BUCKET).download(ownerPath);
    expect(error).toBeNull();
    expect(new Uint8Array(await data!.arrayBuffer())).toEqual(PDF_BYTES);
  });

  it("an outsider can neither download nor sign the owner's file", async () => {
    const { error: downloadError } = await outsider.client.storage
      .from(BUCKET)
      .download(ownerPath);
    expect(downloadError).not.toBeNull();

    const { error: signError } = await outsider.client.storage
      .from(BUCKET)
      .createSignedUrl(ownerPath, 60);
    expect(signError).not.toBeNull();
  });

  it("a circle member shared on documents also cannot reach the owner's files (KAR-41)", async () => {
    // Storage policies are strictly owner-prefix today, so document sharing
    // stops at the metadata row. This pins the current behavior; when
    // KAR-41 extends storage access to circle members, this test must be
    // updated deliberately.
    const { error } = await docsViewer.client.storage.from(BUCKET).download(ownerPath);
    expect(error).not.toBeNull();
  });
});

describe('signed URLs', () => {
  it('a signed URL downloads the file', async () => {
    const { data, error } = await owner.client.storage
      .from(BUCKET)
      .createSignedUrl(ownerPath, 60);
    expect(error).toBeNull();

    const res = await fetch(data!.signedUrl);
    expect(res.ok).toBe(true);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PDF_BYTES);
  });

  it('a signed URL stops working after it expires', async () => {
    const { data } = await owner.client.storage.from(BUCKET).createSignedUrl(ownerPath, 1);

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const res = await fetch(data!.signedUrl);
    expect(res.ok).toBe(false);
  });
});
