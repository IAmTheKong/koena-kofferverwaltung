-- Bring already existing cases in line with the new, separate cable inventory.
-- The former standard quantity of 15 is split into 8 CAT and 7 power cables.
insert into public.case_items (
  suitcase_id, name, expected_quantity, current_quantity, note, sort_order
)
select
  legacy.suitcase_id,
  'Stromkabel',
  7,
  greatest(0, legacy.current_quantity - 8),
  null,
  legacy.sort_order + 1
from public.case_items legacy
where lower(legacy.name) = lower('Kabel & Zubehör')
  and not exists (
    select 1 from public.case_items existing
    where existing.suitcase_id = legacy.suitcase_id
      and lower(existing.name) = lower('Stromkabel')
  );

update public.case_items legacy
set
  name = 'CAT-Kabel',
  expected_quantity = 8,
  current_quantity = least(legacy.current_quantity, 8),
  note = null
where lower(legacy.name) = lower('Kabel & Zubehör')
  and not exists (
    select 1 from public.case_items existing
    where existing.suitcase_id = legacy.suitcase_id
      and existing.id <> legacy.id
      and lower(existing.name) = lower('CAT-Kabel')
  );
