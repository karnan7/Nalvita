-- Nalvita initial schema.
-- Tables: profiles, documents, medicines, vitals, allergies, conditions, doctors.
-- Every table is user-scoped via user_id -> auth.users with row-level security,
-- plus the private 'health-documents' storage bucket.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.blood_group as enum ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  full_name text,
  date_of_birth date,
  gender text check (gender in ('male', 'female', 'other', 'prefer_not_to_say')),
  blood_group public.blood_group,
  height_cm numeric check (height_cm > 0),
  weight_kg numeric check (weight_kg > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create an empty profile row when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  category text not null check (
    category in ('lab_report', 'xray_scan', 'prescription', 'consultation', 'vaccination', 'insurance', 'other')
  ),
  doctor_name text,
  doc_date date,
  file_path text not null,
  file_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 20 * 1024 * 1024),
  notes text,
  created_at timestamptz not null default now()
);

create index documents_user_id_created_at_idx on public.documents (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- medicines
-- ---------------------------------------------------------------------------

create table public.medicines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  dosage text not null,
  frequency text not null check (frequency in ('once_daily', 'twice_daily', 'thrice_daily', 'as_needed')),
  timings text[] not null default '{}' check (timings <@ array['morning', 'afternoon', 'night']),
  doctor_name text,
  start_date date not null,
  end_date date,
  refill_date date,
  status text not null default 'active' check (status in ('active', 'stopped')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index medicines_user_id_status_idx on public.medicines (user_id, status);

create trigger medicines_set_updated_at
  before update on public.medicines
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- vitals
-- ---------------------------------------------------------------------------

create table public.vitals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (
    type in ('blood_pressure', 'blood_sugar_fasting', 'blood_sugar_post_meal', 'weight', 'heart_rate')
  ),
  value_1 numeric not null,
  -- Diastolic value; only blood pressure readings use it.
  value_2 numeric check (type <> 'blood_pressure' or value_2 is not null),
  unit text not null,
  measured_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now()
);

create index vitals_user_id_measured_at_idx on public.vitals (user_id, measured_at desc);

-- ---------------------------------------------------------------------------
-- allergies
-- ---------------------------------------------------------------------------

create table public.allergies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  allergen text not null,
  severity text not null check (severity in ('mild', 'moderate', 'severe')),
  reaction text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index allergies_user_id_idx on public.allergies (user_id);

create trigger allergies_set_updated_at
  before update on public.allergies
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- conditions
-- ---------------------------------------------------------------------------

create table public.conditions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  diagnosis_date date,
  doctor_name text,
  status text not null default 'active' check (status in ('active', 'managed', 'resolved')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conditions_user_id_idx on public.conditions (user_id);

create trigger conditions_set_updated_at
  before update on public.conditions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- doctors
-- ---------------------------------------------------------------------------

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  specialty text,
  hospital text,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index doctors_user_id_idx on public.doctors (user_id);

create trigger doctors_set_updated_at
  before update on public.doctors
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security: users can only read/write their own rows
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.medicines enable row level security;
alter table public.vitals enable row level security;
alter table public.allergies enable row level security;
alter table public.conditions enable row level security;
alter table public.doctors enable row level security;

create policy "Users can view own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own profile" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own profile" on public.profiles
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users can view own documents" on public.documents
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own documents" on public.documents
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own documents" on public.documents
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own documents" on public.documents
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users can view own medicines" on public.medicines
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own medicines" on public.medicines
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own medicines" on public.medicines
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own medicines" on public.medicines
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users can view own vitals" on public.vitals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own vitals" on public.vitals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own vitals" on public.vitals
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own vitals" on public.vitals
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users can view own allergies" on public.allergies
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own allergies" on public.allergies
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own allergies" on public.allergies
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own allergies" on public.allergies
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users can view own conditions" on public.conditions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own conditions" on public.conditions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own conditions" on public.conditions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own conditions" on public.conditions
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users can view own doctors" on public.doctors
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert own doctors" on public.doctors
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update own doctors" on public.doctors
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete own doctors" on public.doctors
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Storage: private 'health-documents' bucket
-- Files are stored under <user_id>/<filename>; access only via signed URLs.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'health-documents',
  'health-documents',
  false,
  20 * 1024 * 1024,
  array['application/pdf', 'image/jpeg', 'image/png']
);

create policy "Users can view own health documents" on storage.objects
  for select to authenticated
  using (bucket_id = 'health-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can upload own health documents" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'health-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can update own health documents" on storage.objects
  for update to authenticated
  using (bucket_id = 'health-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can delete own health documents" on storage.objects
  for delete to authenticated
  using (bucket_id = 'health-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
