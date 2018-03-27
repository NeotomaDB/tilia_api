SELECT  json_build_object('description', '**',
                          'name', proname, 
                          'detailsurl', CONCAT('<a href="?method=', proname, '&action=doc" target="_BLANK">Details</a>'),
                          'params', json_agg(json_build_object('name', (string_to_array(longstring.params, ' '))[1], 
                                                               'type', array_to_string((string_to_array(longstring.params, ' '))[2:], ' '))))
FROM    pg_catalog.pg_namespace n
JOIN    pg_catalog.pg_proc p
ON      pronamespace = n.oid
JOIN    (
  SELECT unnest(regexp_split_to_array(pg_get_function_arguments(p.oid), ', ')) AS params, proname AS funname
  FROM    pg_catalog.pg_namespace n
  JOIN    pg_catalog.pg_proc p
  ON      pronamespace = n.oid
  WHERE   nspname IN ('ti','ts')) AS longstring ON longstring.funname = p.proname
WHERE   nspname IN ('ti','ts')
GROUP BY nspname, proname;