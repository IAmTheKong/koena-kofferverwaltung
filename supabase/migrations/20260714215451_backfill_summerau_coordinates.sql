-- Existing cases predate coordinate storage. They are currently located at the
-- KÖNA base in Summerau, so give them the same verified base coordinates as new cases.
update public.suitcases
set
  current_latitude = 48.5523035,
  current_longitude = 14.4472737
where lower(trim(current_location_name)) = lower('Summerau')
  and (current_latitude is null or current_longitude is null);
