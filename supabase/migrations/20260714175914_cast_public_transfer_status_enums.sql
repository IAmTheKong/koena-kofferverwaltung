do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.submit_public_takeover(uuid,text,text,text,text,jsonb,text)'::regprocedure
  ) into function_definition;
  function_definition := replace(
    function_definition,
    'status = case when has_deviation then ''deviation'' else ''taken_over'' end,',
    'status = (case when has_deviation then ''deviation'' else ''taken_over'' end)::public.transfer_status,'
  );
  function_definition := replace(
    function_definition,
    'status = case when has_deviation then ''deviation'' else ''rented'' end,',
    'status = (case when has_deviation then ''deviation'' else ''rented'' end)::public.case_status,'
  );
  execute function_definition;
end;
$$;
