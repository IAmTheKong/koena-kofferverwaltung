-- Qualify the PL/pgSQL variable where its name also exists as a column.
do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.submit_public_takeover(uuid,text,text,text,text,jsonb,text)'::regprocedure
  ) into function_definition;

  function_definition := replace(
    function_definition,
    'where takeover.transfer_id = transfer_id and takeover.stage = ''takeover''',
    'where takeover.transfer_id = submit_public_takeover.transfer_id and takeover.stage = ''takeover'''
  );

  execute function_definition;
end;
$$;
