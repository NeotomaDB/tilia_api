-- The input signature of one ts.* function: parameter names and their types, in
-- call order. Only input arguments count: OUT / TABLE columns are skipped (they sit
-- in proargnames but not in proargtypes). The server uses this, never the client,
-- to decide how to bind and type each value; the client is never shown it.
-- Overloaded names return more than one row, which the caller treats as unusable.
SELECT p.proname::text AS name,
       ARRAY(
         SELECT a.n::text
         FROM unnest(p.proargnames) WITH ORDINALITY AS a(n, i)
         WHERE p.proargmodes IS NULL OR p.proargmodes[a.i] IN ('i', 'b', 'v')
         ORDER BY a.i
       ) AS names,
       ARRAY(
         SELECT format_type(t.typ, NULL)::text
         FROM unnest(string_to_array(p.proargtypes::text, ' ')::oid[])
              WITH ORDINALITY AS t(typ, i)
         ORDER BY t.i
       ) AS types
FROM pg_catalog.pg_proc AS p
  INNER JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'ts'
  AND p.proname = $1;
