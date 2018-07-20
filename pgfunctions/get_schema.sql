SELECT nspname
FROM pg_catalog.pg_namespace n
  JOIN    pg_catalog.pg_proc p
  ON      pronamespace = n.oid
  WHERE   proname LIKE $1;