-- Reproducible administration schema and atomic suitcase creation.
create extension if not exists btree_gist with schema extensions;

do $$ begin
  create type public.case_status as enum ('available', 'reserved', 'rented', 'awaiting_takeover', 'deviation', 'out_of_service');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.booking_status as enum ('requested', 'confirmed', 'cancelled', 'completed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.transfer_status as enum ('draft', 'checkout_complete', 'taken_over', 'deviation', 'cancelled');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.count_stage as enum ('checkout', 'takeover');
exception when duplicate_object then null; end $$;

create table if not exists public.suitcases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique,
  name text not null,
  description text,
  status public.case_status not null default 'available',
  qr_public_id uuid not null unique default gen_random_uuid(),
  current_holder_name text,
  current_holder_address text,
  current_location_name text not null default 'Lager Freistadt',
  current_latitude numeric(8,6),
  current_longitude numeric(9,6),
  return_due_on date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((current_latitude is null) = (current_longitude is null))
);

alter table public.suitcases add column if not exists description text;
alter table public.suitcases add column if not exists archived_at timestamptz;
alter table public.suitcases drop constraint if exists suitcases_case_number_check;
alter table public.suitcases add constraint suitcases_case_number_check
  check (case_number ~ '^K(FR)?-[0-9]{3}$') not valid;
alter table public.suitcases validate constraint suitcases_case_number_check;

create table if not exists public.case_items (
  id uuid primary key default gen_random_uuid(),
  suitcase_id uuid not null references public.suitcases(id) on delete cascade,
  name text not null,
  expected_quantity integer not null check (expected_quantity >= 0),
  current_quantity integer not null check (current_quantity >= 0),
  requires_serial_number boolean not null default false,
  serial_number text,
  note text,
  sort_order smallint not null default 0,
  unique (suitcase_id, name)
);
alter table public.case_items add column if not exists serial_number text;
alter table public.case_items add column if not exists note text;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  suitcase_id uuid not null references public.suitcases(id) on delete restrict,
  customer_name text not null,
  customer_phone text,
  customer_address text,
  location_name text,
  starts_on date not null,
  ends_on date not null,
  status public.booking_status not null default 'requested',
  note text,
  created_at timestamptz not null default now(),
  check (starts_on <= ends_on)
);

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_no_overlapping_active_dates'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings add constraint bookings_no_overlapping_active_dates
      exclude using gist (suitcase_id with =, daterange(starts_on, ends_on, '[]') with &&)
      where (status in ('requested', 'confirmed'));
  end if;
end $$;

create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  suitcase_id uuid not null references public.suitcases(id) on delete restrict,
  booking_id uuid references public.bookings(id) on delete set null,
  status public.transfer_status not null default 'draft',
  checkout_holder_name text,
  checkout_at timestamptz,
  checkout_location_name text,
  takeover_holder_name text,
  takeover_holder_address text,
  takeover_holder_phone text,
  takeover_at timestamptz,
  takeover_location_name text,
  public_token_hash text unique,
  token_expires_at timestamptz,
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.transfer_counts (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.transfers(id) on delete cascade,
  case_item_id uuid not null references public.case_items(id) on delete restrict,
  stage public.count_stage not null,
  counted_quantity integer not null check (counted_quantity >= 0),
  condition_note text,
  unique (transfer_id, case_item_id, stage)
);

create table if not exists public.case_events (
  id uuid primary key default gen_random_uuid(),
  suitcase_id uuid not null references public.suitcases(id) on delete cascade,
  transfer_id uuid references public.transfers(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  event_type text not null,
  location_name text,
  holder_name text,
  note text,
  occurred_at timestamptz not null default now()
);

create index if not exists bookings_suitcase_dates_idx on public.bookings (suitcase_id, starts_on, ends_on);
create index if not exists case_items_suitcase_idx on public.case_items (suitcase_id, sort_order);
create index if not exists case_events_suitcase_occurred_idx on public.case_events (suitcase_id, occurred_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists suitcases_updated_at on public.suitcases;
create trigger suitcases_updated_at before update on public.suitcases
  for each row execute function public.set_updated_at();

alter table public.suitcases enable row level security;
alter table public.case_items enable row level security;
alter table public.bookings enable row level security;
alter table public.transfers enable row level security;
alter table public.transfer_counts enable row level security;
alter table public.case_events enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['suitcases','case_items','bookings','transfers','transfer_counts','case_events'] loop
    execute format('drop policy if exists "admin manages %s" on public.%I', replace(table_name, '_', ' '), table_name);
    execute format(
      'create policy "admin manages %s" on public.%I for all to authenticated using (((select auth.jwt()) -> ''app_metadata'' ->> ''role'') = ''admin'') with check (((select auth.jwt()) -> ''app_metadata'' ->> ''role'') = ''admin'')',
      replace(table_name, '_', ' '), table_name
    );
  end loop;
end $$;

grant select, insert, update, delete on public.suitcases, public.case_items, public.bookings,
  public.transfers, public.transfer_counts, public.case_events to authenticated;

create or replace function public.create_suitcase_with_items(
  p_case_number text,
  p_name text,
  p_description text,
  p_location text,
  p_items jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_id uuid;
  item jsonb;
  item_index integer := 0;
begin
  if ((select auth.jwt()) -> 'app_metadata' ->> 'role') is distinct from 'admin' then
    raise exception 'Nur Administratoren dürfen Koffer anlegen' using errcode = '42501';
  end if;
  if p_case_number !~ '^K(FR)?-[0-9]{3}$' then
    raise exception 'Ungültige Koffer-ID (erwartet: KFR-001)' using errcode = '22023';
  end if;
  if nullif(trim(p_name), '') is null or nullif(trim(p_location), '') is null then
    raise exception 'Bezeichnung und Standort sind Pflichtfelder' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Mindestens eine Inhaltsposition ist erforderlich' using errcode = '22023';
  end if;

  insert into public.suitcases (case_number, name, description, current_location_name)
  values (upper(trim(p_case_number)), trim(p_name), nullif(trim(p_description), ''), trim(p_location))
  returning id into new_id;

  for item in select value from jsonb_array_elements(p_items) loop
    if nullif(trim(item ->> 'name'), '') is null then
      raise exception 'Gegenstandsname darf nicht leer sein' using errcode = '22023';
    end if;
    insert into public.case_items (
      suitcase_id, name, expected_quantity, current_quantity, note, sort_order
    ) values (
      new_id,
      trim(item ->> 'name'),
      greatest(0, coalesce((item ->> 'expected_quantity')::integer, 0)),
      greatest(0, coalesce((item ->> 'expected_quantity')::integer, 0)),
      nullif(trim(item ->> 'note'), ''),
      item_index
    );
    item_index := item_index + 1;
  end loop;

  insert into public.case_events (suitcase_id, event_type, location_name, note)
  values (new_id, 'Koffer angelegt', trim(p_location), 'Status: Verfügbar');
  return new_id;
end;
$$;

revoke all on function public.create_suitcase_with_items(text,text,text,text,jsonb) from public, anon;
grant execute on function public.create_suitcase_with_items(text,text,text,text,jsonb) to authenticated;
