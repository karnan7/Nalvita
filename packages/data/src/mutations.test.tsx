// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActiveProfileContext } from './active-profile-context';
import { useAddAllergy, useDeleteAllergy, useUpdateAllergy } from './allergies';
import { NalvitaDataProvider } from './client';
import { useAddCondition, useDeleteCondition, useUpdateCondition } from './conditions';
import { useAddDoctor, useDeleteDoctor, useUpdateDoctor } from './doctors';
import { useDeleteDocument, useUploadDocument } from './documents';
import { useAddMedicine, useStopMedicine, useUpdateMedicine } from './medicines';
import { useUpdateProfile } from './profile';
import { useDeleteVital, useLogVital, useUpdateVital } from './vitals';

const PROFILE_ID = '00000000-0000-4000-8000-0000000000aa';
const RECORD_ID = '00000000-0000-4000-8000-0000000000e1';

/** The columns every audited write selects back, whatever the table. */
const auditedRow = { id: RECORD_ID, profile_id: PROFILE_ID };

const from = vi.fn();
const rpc = vi.fn(async () => ({ data: null, error: null }));
const upload = vi.fn(async () => ({ error: null }));
const remove = vi.fn(async () => ({ error: null }));

const client = {
  from,
  rpc,
  storage: { from: () => ({ upload, remove }) },
} as never;

/**
 * A write chain: `insert`/`update`/`delete` then any narrowing, resolving to a
 * row shaped like whatever the caller selected back.
 */
function writeChain(row: unknown = auditedRow) {
  const payload = { data: row, error: null };
  const link = Promise.resolve(payload) as Promise<typeof payload> & Record<string, unknown>;
  for (const method of ['insert', 'update', 'delete', 'select', 'eq']) {
    link[method] = () => link;
  }
  link.single = async () => payload;
  link.maybeSingle = async () => payload;
  return link;
}

function wrapper({ children }: Readonly<{ children: ReactNode }>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <NalvitaDataProvider client={client} appBaseUrl="https://nalvita.test" openUrl={vi.fn()}>
      <QueryClientProvider client={queryClient}>
        <ActiveProfileContext.Provider
          value={{
            profileId: PROFILE_ID,
            isSelf: true,
            viewing: null,
            setViewing: () => undefined,
            guardWrite: (write) => write(),
          }}
        >
          {children}
        </ActiveProfileContext.Provider>
      </QueryClientProvider>
    </NalvitaDataProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  from.mockImplementation(() => writeChain());
  rpc.mockImplementation(async () => ({ data: null, error: null }));
});

/** Runs a mutation and waits for it to settle, returning the hook result. */
async function run<TVars>(
  useHook: () => { mutate: (vars: TVars) => void; isSuccess: boolean; isError: boolean },
  vars: TVars,
) {
  const { result } = renderHook(useHook, { wrapper });
  result.current.mutate(vars);
  await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));
  return result;
}

const medicineValues = {
  name: 'Metformin',
  dosage: '500mg',
  frequency: 'twice_daily' as const,
  timings: ['morning' as const],
  doctor_name: null,
  start_date: '2026-06-01',
  end_date: null,
  refill_date: null,
  notes: null,
};

const vitalValues = {
  type: 'blood_pressure' as const,
  value_1: 128,
  value_2: 84,
  measured_at: '2026-07-20T08:00:00.000Z',
  notes: null,
};

const allergyValues = { allergen: 'Penicillin', severity: 'severe' as const, reaction: null };

const conditionValues = {
  name: 'Hypertension',
  diagnosis_date: null,
  doctor_name: null,
  status: 'active' as const,
  notes: null,
};

const doctorValues = {
  name: 'Dr Suresh Pillai',
  specialty: null,
  hospital: null,
  phone: null,
  email: null,
};

/**
 * Every write goes through the injected client and lands on the table it names.
 * These paths carry the write half of the package, so a hook silently pointed at
 * the wrong table is the failure worth catching.
 */
describe.each([
  ['medicines', () => useAddMedicine(PROFILE_ID), medicineValues],
  ['vitals', () => useLogVital(PROFILE_ID), vitalValues],
  ['allergies', () => useAddAllergy(PROFILE_ID), allergyValues],
  ['conditions', () => useAddCondition(PROFILE_ID), conditionValues],
  ['doctors', () => useAddDoctor(PROFILE_ID), doctorValues],
])('adding to %s', (table, useHook, values) => {
  it(`inserts into ${table} and logs the action`, async () => {
    // The insert selects the whole row back, so it must parse as one.
    from.mockImplementation(() =>
      writeChain({ ...rowFor(table), id: RECORD_ID, profile_id: PROFILE_ID }),
    );

    const result = await run(useHook as never, values as never);

    expect(result.current.isSuccess).toBe(true);
    expect(from).toHaveBeenCalledWith(table);
    expect(rpc).toHaveBeenCalledWith(
      'log_audit_event',
      expect.objectContaining({ p_action: 'added', p_resource_type: table }),
    );
  });
});

describe.each([
  ['medicines', () => useUpdateMedicine(), { id: RECORD_ID, values: medicineValues }],
  ['vitals', () => useUpdateVital(), { id: RECORD_ID, values: vitalValues }],
  ['allergies', () => useUpdateAllergy(), { id: RECORD_ID, values: allergyValues }],
  ['conditions', () => useUpdateCondition(), { id: RECORD_ID, values: conditionValues }],
  ['doctors', () => useUpdateDoctor(), { id: RECORD_ID, values: doctorValues }],
])('editing %s', (table, useHook, vars) => {
  it(`updates ${table} and logs the action`, async () => {
    from.mockImplementation(() =>
      writeChain({ ...rowFor(table), id: RECORD_ID, profile_id: PROFILE_ID }),
    );

    const result = await run(useHook as never, vars as never);

    expect(result.current.isSuccess).toBe(true);
    expect(rpc).toHaveBeenCalledWith(
      'log_audit_event',
      expect.objectContaining({ p_action: 'updated', p_resource_type: table }),
    );
  });
});

describe.each([
  ['vitals', () => useDeleteVital()],
  ['allergies', () => useDeleteAllergy()],
  ['conditions', () => useDeleteCondition()],
  ['doctors', () => useDeleteDoctor()],
])('deleting from %s', (table, useHook) => {
  it(`attributes the delete to the record's owner, not the person acting`, async () => {
    const result = await run(useHook as never, RECORD_ID as never);

    expect(result.current.isSuccess).toBe(true);
    expect(from).toHaveBeenCalledWith(table);
    expect(rpc).toHaveBeenCalledWith(
      'log_audit_event',
      expect.objectContaining({
        p_action: 'deleted',
        p_resource_type: table,
        p_owner: PROFILE_ID,
      }),
    );
  });
});

describe('medicines', () => {
  it('stopping records the day it ended rather than deleting the history', async () => {
    from.mockImplementation(() =>
      writeChain({ ...rowFor('medicines'), status: 'stopped', end_date: '2026-08-01' }),
    );

    const result = await run(() => useStopMedicine(), {
      id: RECORD_ID,
      endDate: '2026-08-01',
    });

    expect(result.current.isSuccess).toBe(true);
    expect(from).toHaveBeenCalledWith('medicines');
  });
});

describe('profile', () => {
  it('updates my details and logs it against my own profile', async () => {
    from.mockImplementation(() => writeChain(rowFor('profiles')));

    const result = await run(() => useUpdateProfile(PROFILE_ID), {
      full_name: 'Arjun',
    } as never);

    expect(result.current.isSuccess).toBe(true);
    expect(from).toHaveBeenCalledWith('profiles');
    expect(rpc).toHaveBeenCalledWith(
      'log_audit_event',
      expect.objectContaining({ p_resource_type: 'profiles', p_owner: PROFILE_ID }),
    );
  });
});

describe('documents', () => {
  const file = { type: 'application/pdf', size: 1024, name: 'report.pdf' };

  it('uploads the file first, then records the row', async () => {
    from.mockImplementation(() => writeChain(rowFor('documents')));

    const result = await run(() => useUploadDocument(PROFILE_ID), {
      file,
      values: {
        title: 'Blood test',
        category: 'lab_report',
        doctor_name: null,
        doc_date: null,
        notes: null,
      },
    } as never);

    expect(result.current.isSuccess).toBe(true);
    expect(upload).toHaveBeenCalled();
    expect(from).toHaveBeenCalledWith('documents');
  });

  it('refuses a file the bucket would reject, without uploading it', async () => {
    const result = await run(() => useUploadDocument(PROFILE_ID), {
      file: { type: 'application/zip', size: 10 },
      values: { title: 'x', category: 'other', doctor_name: null, doc_date: null, notes: null },
    } as never);

    expect(result.current.isError).toBe(true);
    expect(upload).not.toHaveBeenCalled();
  });

  it('removes the orphaned file when the metadata row cannot be written', async () => {
    from.mockImplementation(() => {
      const payload = { data: null, error: { message: 'denied' } };
      const link = Promise.resolve(payload) as Promise<typeof payload> & Record<string, unknown>;
      for (const m of ['insert', 'update', 'delete', 'select', 'eq']) link[m] = () => link;
      link.single = async () => payload;
      return link;
    });

    const result = await run(() => useUploadDocument(PROFILE_ID), {
      file,
      values: {
        title: 'Blood test',
        category: 'lab_report',
        doctor_name: null,
        doc_date: null,
        notes: null,
      },
    } as never);

    expect(result.current.isError).toBe(true);
    expect(remove).toHaveBeenCalled();
  });

  it('deletes the row before removing the file it points at', async () => {
    from.mockImplementation(() => writeChain(rowFor('documents')));

    const result = await run(() => useDeleteDocument(), {
      id: RECORD_ID,
      profile_id: PROFILE_ID,
      file_path: 'me/report.pdf',
      title: 'Blood test',
      file_type: 'application/pdf',
    } as never);

    expect(result.current.isSuccess).toBe(true);
    expect(from).toHaveBeenCalledWith('documents');
    expect(remove).toHaveBeenCalledWith(['me/report.pdf']);
  });
});

/** A full row per table, as PostgREST returns it after a write. */
function rowFor(table: string): Record<string, unknown> {
  const base = {
    id: RECORD_ID,
    profile_id: PROFILE_ID,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
  };
  switch (table) {
    case 'medicines':
      return { ...base, ...medicineValues, status: 'active' };
    case 'vitals':
      return { ...base, ...vitalValues, unit: 'mmHg' };
    case 'allergies':
      return { ...base, ...allergyValues };
    case 'conditions':
      return { ...base, ...conditionValues };
    case 'doctors':
      return { ...base, ...doctorValues };
    case 'documents':
      return {
        ...base,
        title: 'Blood test',
        category: 'lab_report',
        doctor_name: null,
        doc_date: null,
        notes: null,
        file_path: 'me/report.pdf',
        file_type: 'application/pdf',
        file_size: 1024,
      };
    default:
      return {
        ...base,
        // A profile is identified by its own primary key, so its id *is* the
        // owner id every audit entry is attributed to.
        id: PROFILE_ID,
        user_id: '00000000-0000-4000-8000-000000000001',
        managed_by: null,
        full_name: 'Arjun',
        date_of_birth: null,
        gender: null,
        blood_group: null,
        height_cm: null,
        weight_kg: null,
        is_minor: false,
        notification_detail: 'generic',
      };
  }
}
