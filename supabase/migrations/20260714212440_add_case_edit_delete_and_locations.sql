-- New cases always start at the KÖNA base in Summerau.
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
  if nullif(trim(p_name), '') is null then
    raise exception 'Bezeichnung ist ein Pflichtfeld' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Mindestens eine Inhaltsposition ist erforderlich' using errcode = '22023';
  end if;

  insert into public.suitcases (
    case_number, name, description, current_location_name,
    current_latitude, current_longitude
  ) values (
    upper(trim(p_case_number)), trim(p_name), nullif(trim(p_description), ''),
    'Summerau', 48.5523035, 14.4472737
  ) returning id into new_id;

  for item in select value from jsonb_array_elements(p_items) loop
    if nullif(trim(item ->> 'name'), '') is null then
      raise exception 'Gegenstandsname darf nicht leer sein' using errcode = '22023';
    end if;
    insert into public.case_items (
      suitcase_id, name, expected_quantity, current_quantity, note, sort_order
    ) values (
      new_id, trim(item ->> 'name'),
      greatest(0, coalesce((item ->> 'expected_quantity')::integer, 0)),
      greatest(0, coalesce((item ->> 'expected_quantity')::integer, 0)),
      null, item_index
    );
    item_index := item_index + 1;
  end loop;

  insert into public.case_events (suitcase_id, event_type, location_name, note)
  values (new_id, 'Koffer angelegt', 'Summerau', 'Status: Verfügbar');
  return new_id;
end;
$$;

create or replace function public.update_suitcase_with_items(
  p_suitcase_id uuid,
  p_name text,
  p_description text,
  p_status public.case_status,
  p_items jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  item jsonb;
  item_id uuid;
  item_index integer := 0;
begin
  if ((select auth.jwt()) -> 'app_metadata' ->> 'role') is distinct from 'admin' then
    raise exception 'Nur Administratoren dürfen Koffer bearbeiten' using errcode = '42501';
  end if;
  if nullif(trim(p_name), '') is null then
    raise exception 'Bezeichnung ist ein Pflichtfeld' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Mindestens eine Inhaltsposition ist erforderlich' using errcode = '22023';
  end if;

  update public.suitcases set
    name = trim(p_name), description = nullif(trim(p_description), ''), status = p_status
  where id = p_suitcase_id and archived_at is null;
  if not found then raise exception 'Koffer nicht gefunden' using errcode = 'P0002'; end if;

  -- Temporary names make swaps such as "CAT-Kabel" <-> "Stromkabel" safe.
  update public.case_items set name = '__editing__' || id::text where suitcase_id = p_suitcase_id;

  delete from public.case_items ci
  where ci.suitcase_id = p_suitcase_id
    and not exists (
      select 1 from jsonb_array_elements(p_items) value
      where nullif(value ->> 'id', '')::uuid = ci.id
    );

  for item in select value from jsonb_array_elements(p_items) loop
    if nullif(trim(item ->> 'name'), '') is null then
      raise exception 'Gegenstandsname darf nicht leer sein' using errcode = '22023';
    end if;
    item_id := nullif(item ->> 'id', '')::uuid;
    if item_id is null then
      insert into public.case_items (
        suitcase_id, name, expected_quantity, current_quantity, note, sort_order
      ) values (
        p_suitcase_id, trim(item ->> 'name'),
        greatest(0, coalesce((item ->> 'expected_quantity')::integer, 0)),
        greatest(0, coalesce((item ->> 'expected_quantity')::integer, 0)),
        null, item_index
      );
    else
      update public.case_items set
        name = trim(item ->> 'name'),
        expected_quantity = greatest(0, coalesce((item ->> 'expected_quantity')::integer, 0)),
        current_quantity = greatest(0, coalesce((item ->> 'expected_quantity')::integer, 0)),
        note = null,
        sort_order = item_index
      where id = item_id and suitcase_id = p_suitcase_id;
      if not found then raise exception 'Ungültige Inhaltsposition' using errcode = '22023'; end if;
    end if;
    item_index := item_index + 1;
  end loop;

  insert into public.case_events (suitcase_id, event_type, location_name, note)
  select id, 'Koffer und Inhalt bearbeitet', current_location_name,
    jsonb_array_length(p_items) || ' Inhaltspositionen'
  from public.suitcases where id = p_suitcase_id;
  return p_suitcase_id;
exception
  when foreign_key_violation then
    raise exception 'Bereits gezählte Inhaltspositionen können nicht gelöscht werden. Setze ihre Menge stattdessen auf 0.' using errcode = '23503';
end;
$$;

create or replace function public.delete_suitcase_admin(p_suitcase_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if ((select auth.jwt()) -> 'app_metadata' ->> 'role') is distinct from 'admin' then
    raise exception 'Nur Administratoren dürfen Koffer löschen' using errcode = '42501';
  end if;
  delete from public.case_events where suitcase_id = p_suitcase_id;
  delete from public.transfers where suitcase_id = p_suitcase_id;
  delete from public.bookings where suitcase_id = p_suitcase_id;
  delete from public.suitcases where id = p_suitcase_id;
  if not found then raise exception 'Koffer nicht gefunden' using errcode = 'P0002'; end if;
end;
$$;

-- Coordinates are submitted only after an explicit browser location action.
create or replace function public.set_public_suitcase_coordinates(
  p_public_id uuid,
  p_latitude numeric,
  p_longitude numeric
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Ungültige Koordinaten' using errcode = '22023';
  end if;
  update public.suitcases set current_latitude = p_latitude, current_longitude = p_longitude
  where qr_public_id = p_public_id and archived_at is null;
  if not found then raise exception 'Koffer nicht gefunden' using errcode = 'P0002'; end if;
end;
$$;

-- When a handover changes the textual location, old coordinates must not remain
-- attached to the new address. A subsequent explicit browser-location action
-- writes the new coordinates through set_public_suitcase_coordinates().
create or replace function public.clear_stale_suitcase_coordinates()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.current_location_name is distinct from old.current_location_name
    and new.current_latitude is not distinct from old.current_latitude
    and new.current_longitude is not distinct from old.current_longitude then
    new.current_latitude := null;
    new.current_longitude := null;
  end if;
  return new;
end;
$$;

drop trigger if exists clear_stale_suitcase_coordinates on public.suitcases;
create trigger clear_stale_suitcase_coordinates
before update of current_location_name on public.suitcases
for each row execute function public.clear_stale_suitcase_coordinates();

revoke all on function public.update_suitcase_with_items(uuid,text,text,public.case_status,jsonb) from public, anon;
revoke all on function public.delete_suitcase_admin(uuid) from public, anon;
revoke all on function public.set_public_suitcase_coordinates(uuid,numeric,numeric) from public;
grant execute on function public.update_suitcase_with_items(uuid,text,text,public.case_status,jsonb) to authenticated;
grant execute on function public.delete_suitcase_admin(uuid) to authenticated;
grant execute on function public.set_public_suitcase_coordinates(uuid,numeric,numeric) to anon, authenticated;
