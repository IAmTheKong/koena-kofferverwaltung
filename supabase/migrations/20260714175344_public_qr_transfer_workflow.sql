-- QR codes contain a high-entropy public UUID. These narrowly scoped functions
-- expose no holder/contact data and validate every submitted item against the
-- suitcase before writing. Table access remains blocked by RLS for anon users.

create or replace function public.get_public_suitcase(p_public_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', s.id,
    'case_number', s.case_number,
    'name', s.name,
    'description', s.description,
    'status', s.status,
    'location', s.current_location_name,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ci.id,
        'name', ci.name,
        'expected', ci.expected_quantity,
        'actual', ci.current_quantity
      ) order by ci.sort_order, ci.name)
      from public.case_items ci where ci.suitcase_id = s.id
    ), '[]'::jsonb)
  )
  from public.suitcases s
  where s.qr_public_id = p_public_id and s.archived_at is null;
$$;

create or replace function public.submit_public_checkout(
  p_public_id uuid,
  p_counts jsonb,
  p_note text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  suitcase_record public.suitcases%rowtype;
  transfer_id uuid;
  count_entry jsonb;
  inserted_count integer := 0;
  expected_count integer;
begin
  select * into suitcase_record from public.suitcases
    where qr_public_id = p_public_id and archived_at is null for update;
  if not found then raise exception 'Koffer nicht gefunden' using errcode = 'P0002'; end if;
  if suitcase_record.status in ('available', 'reserved', 'awaiting_takeover', 'out_of_service') then
    raise exception 'Für diesen Koffer kann aktuell kein Abschluss gestartet werden' using errcode = '22023';
  end if;
  if jsonb_typeof(p_counts) <> 'array' then raise exception 'Ungültige Zählung' using errcode = '22023'; end if;

  insert into public.transfers (
    suitcase_id, status, checkout_holder_name, checkout_at, checkout_location_name, comment
  ) values (
    suitcase_record.id, 'checkout_complete', suitcase_record.current_holder_name, now(),
    suitcase_record.current_location_name, nullif(trim(p_note), '')
  ) returning id into transfer_id;

  for count_entry in select value from jsonb_array_elements(p_counts) loop
    insert into public.transfer_counts (transfer_id, case_item_id, stage, counted_quantity, condition_note)
    select transfer_id, ci.id, 'checkout', greatest(0, (count_entry ->> 'counted_quantity')::integer),
      nullif(trim(count_entry ->> 'note'), '')
    from public.case_items ci
    where ci.id = (count_entry ->> 'case_item_id')::uuid and ci.suitcase_id = suitcase_record.id;
    if not found then raise exception 'Ungültige Inhaltsposition' using errcode = '22023'; end if;
    inserted_count := inserted_count + 1;
  end loop;

  select count(*) into expected_count from public.case_items where suitcase_id = suitcase_record.id;
  if inserted_count <> expected_count then raise exception 'Alle Inhaltspositionen müssen gezählt werden' using errcode = '22023'; end if;

  update public.suitcases set status = 'awaiting_takeover', current_holder_name = null where id = suitcase_record.id;
  insert into public.case_events (suitcase_id, transfer_id, event_type, location_name, holder_name, note)
  values (suitcase_record.id, transfer_id, 'Abschluss erfolgt – wartet auf Übernahme',
    suitcase_record.current_location_name, suitcase_record.current_holder_name, nullif(trim(p_note), ''));
  return transfer_id;
end;
$$;

create or replace function public.submit_public_takeover(
  p_public_id uuid,
  p_name text,
  p_address text,
  p_phone text,
  p_location text,
  p_counts jsonb,
  p_note text default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  suitcase_record public.suitcases%rowtype;
  transfer_id uuid;
  count_entry jsonb;
  inserted_count integer := 0;
  expected_count integer;
  has_deviation boolean;
begin
  if nullif(trim(p_name), '') is null or nullif(trim(p_address), '') is null or nullif(trim(p_location), '') is null then
    raise exception 'Name, Adresse und Standort sind Pflichtfelder' using errcode = '22023';
  end if;
  select * into suitcase_record from public.suitcases
    where qr_public_id = p_public_id and archived_at is null for update;
  if not found then raise exception 'Koffer nicht gefunden' using errcode = 'P0002'; end if;
  if suitcase_record.status = 'out_of_service' then raise exception 'Dieser Koffer ist gesperrt' using errcode = '22023'; end if;

  select id into transfer_id from public.transfers
    where suitcase_id = suitcase_record.id and status = 'checkout_complete'
    order by created_at desc limit 1 for update;

  if transfer_id is null then
    if suitcase_record.status not in ('available', 'reserved') then
      raise exception 'Es ist keine offene Übernahme vorhanden' using errcode = '22023';
    end if;
    insert into public.transfers (
      suitcase_id, status, checkout_holder_name, checkout_at, checkout_location_name, comment
    ) values (
      suitcase_record.id, 'checkout_complete', 'Lager', now(), suitcase_record.current_location_name,
      'Direkte Erstübernahme aus dem Lager'
    ) returning id into transfer_id;
    insert into public.transfer_counts (transfer_id, case_item_id, stage, counted_quantity)
      select transfer_id, id, 'checkout', current_quantity from public.case_items where suitcase_id = suitcase_record.id;
  end if;

  for count_entry in select value from jsonb_array_elements(p_counts) loop
    insert into public.transfer_counts (transfer_id, case_item_id, stage, counted_quantity, condition_note)
    select transfer_id, ci.id, 'takeover', greatest(0, (count_entry ->> 'counted_quantity')::integer),
      nullif(trim(count_entry ->> 'note'), '')
    from public.case_items ci
    where ci.id = (count_entry ->> 'case_item_id')::uuid and ci.suitcase_id = suitcase_record.id;
    if not found then raise exception 'Ungültige Inhaltsposition' using errcode = '22023'; end if;
    inserted_count := inserted_count + 1;
  end loop;

  select count(*) into expected_count from public.case_items where suitcase_id = suitcase_record.id;
  if inserted_count <> expected_count then raise exception 'Alle Inhaltspositionen müssen gezählt werden' using errcode = '22023'; end if;

  select exists (
    select 1 from public.transfer_counts takeover
    join public.case_items ci on ci.id = takeover.case_item_id
    left join public.transfer_counts checkout on checkout.transfer_id = takeover.transfer_id
      and checkout.case_item_id = takeover.case_item_id and checkout.stage = 'checkout'
    where takeover.transfer_id = transfer_id and takeover.stage = 'takeover'
      and (takeover.counted_quantity <> ci.expected_quantity or takeover.counted_quantity <> checkout.counted_quantity)
  ) into has_deviation;

  update public.case_items ci set current_quantity = counts.counted_quantity
    from public.transfer_counts counts
    where counts.transfer_id = transfer_id and counts.stage = 'takeover' and counts.case_item_id = ci.id;
  update public.transfers set
    status = case when has_deviation then 'deviation' else 'taken_over' end,
    takeover_holder_name = trim(p_name), takeover_holder_address = trim(p_address),
    takeover_holder_phone = nullif(trim(p_phone), ''), takeover_at = now(),
    takeover_location_name = trim(p_location), comment = concat_ws(E'\n', comment, nullif(trim(p_note), ''))
    where id = transfer_id;
  update public.suitcases set
    status = case when has_deviation then 'deviation' else 'rented' end,
    current_holder_name = trim(p_name), current_holder_address = trim(p_address),
    current_location_name = trim(p_location)
    where id = suitcase_record.id;
  insert into public.case_events (suitcase_id, transfer_id, event_type, location_name, holder_name, note)
  values (suitcase_record.id, transfer_id,
    case when has_deviation then 'Übernahme mit Abweichung' else 'Übernahme abgeschlossen' end,
    trim(p_location), trim(p_name), nullif(trim(p_note), ''));
  return case when has_deviation then 'deviation' else 'taken_over' end;
end;
$$;

revoke all on function public.get_public_suitcase(uuid) from public;
revoke all on function public.submit_public_checkout(uuid,jsonb,text) from public;
revoke all on function public.submit_public_takeover(uuid,text,text,text,text,jsonb,text) from public;
grant execute on function public.get_public_suitcase(uuid) to anon, authenticated;
grant execute on function public.submit_public_checkout(uuid,jsonb,text) to anon, authenticated;
grant execute on function public.submit_public_takeover(uuid,text,text,text,text,jsonb,text) to anon, authenticated;
