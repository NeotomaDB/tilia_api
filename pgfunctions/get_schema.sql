SELECT nspname,
       pg_get_function_arguments(p.oid)
FROM pg_catalog.pg_namespace n
  JOIN    pg_catalog.pg_proc p
  ON      pronamespace = n.oid
  WHERE   proname LIKE $1;
