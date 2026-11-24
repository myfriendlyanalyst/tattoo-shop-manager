-- Metadata only. psql -X -qAt -v ON_ERROR_STOP=1 -f this-file.sql -o snapshot.json
-- No customer rows, auth users, tokens, template bodies or sequence values.
begin transaction read only;
set local search_path = pg_catalog, public;
select jsonb_build_object(
  'relations', coalesce((select jsonb_agg(jsonb_build_object(
    'name', c.relname, 'kind', c.relkind, 'rls', c.relrowsecurity,
    'force_rls', c.relforcerowsecurity, 'options', c.reloptions,
    'view', case when c.relkind in ('v','m') then pg_get_viewdef(c.oid, true) end
  ) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p','v','m')), '[]'::jsonb),
  'columns', coalesce((select jsonb_agg(jsonb_build_object(
    'table', c.relname, 'name', a.attname, 'position', a.attnum,
    'type', format_type(a.atttypid,a.atttypmod), 'not_null', a.attnotnull,
    'identity', a.attidentity, 'generated', a.attgenerated,
    'default', pg_get_expr(d.adbin,d.adrelid)
  ) order by c.relname,a.attnum) from pg_attribute a
    join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
    left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where n.nspname='public' and c.relkind in ('r','p','v','m') and a.attnum>0 and not a.attisdropped), '[]'::jsonb),
  'constraints', coalesce((select jsonb_agg(jsonb_build_object(
    'table', c.conrelid::regclass::text, 'name', c.conname,
    'definition', pg_get_constraintdef(c.oid,true), 'validated', c.convalidated
  ) order by c.conrelid::regclass::text,c.conname) from pg_constraint c
    join pg_namespace n on n.oid=c.connamespace where n.nspname='public'), '[]'::jsonb),
  'indexes', coalesce((select jsonb_agg(to_jsonb(i) order by i.tablename,i.indexname)
    from pg_indexes i where schemaname='public'), '[]'::jsonb),
  'functions', coalesce((select jsonb_agg(jsonb_build_object(
    'name', p.proname, 'arguments', pg_get_function_identity_arguments(p.oid),
    'definition', pg_get_functiondef(p.oid)
  ) order by p.proname,pg_get_function_identity_arguments(p.oid)) from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind in ('f','p')
    and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')), '[]'::jsonb),
  'triggers', coalesce((select jsonb_agg(jsonb_build_object(
    'table', c.relname, 'name', t.tgname, 'enabled', t.tgenabled,
    'definition', pg_get_triggerdef(t.oid,true)
  ) order by c.relname,t.tgname) from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal), '[]'::jsonb),
  'policies', coalesce((select jsonb_agg(to_jsonb(p) order by p.schemaname,p.tablename,p.policyname)
    from pg_policies p where p.schemaname='public' or
      (p.schemaname='storage' and p.policyname like 'request_references_%')), '[]'::jsonb),
  'enums', coalesce((select jsonb_agg(jsonb_build_object(
    'type', t.typname, 'label', e.enumlabel, 'order', e.enumsortorder
  ) order by t.typname,e.enumsortorder) from pg_enum e join pg_type t on t.oid=e.enumtypid
    join pg_namespace n on n.oid=t.typnamespace where n.nspname='public'), '[]'::jsonb),
  'grants', coalesce((select jsonb_agg(to_jsonb(g) order by g.object,g.grantee,g.privilege) from (
    select 'relation:'||c.relname as object, case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as grantee,
      a.privilege_type as privilege, a.is_grantable from pg_class c join pg_namespace n on n.oid=c.relnamespace,
      lateral aclexplode(coalesce(c.relacl,acldefault(case when c.relkind='S' then 'S'::"char" else 'r'::"char" end,c.relowner))) a
      where n.nspname='public' and c.relkind in ('r','p','v','m','S')
    union all
    select 'function:'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
      case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace,
      lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where n.nspname='public'
    union all
    select 'schema:'||n.nspname,case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
      a.privilege_type,a.is_grantable from pg_namespace n,
      lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a where n.nspname='public'
  ) g), '[]'::jsonb),
  'extensions', coalesce((select jsonb_agg(jsonb_build_object('name',e.extname,'schema',n.nspname,'version',e.extversion) order by e.extname)
    from pg_extension e join pg_namespace n on n.oid=e.extnamespace), '[]'::jsonb),
  'sequences', coalesce((select jsonb_agg(jsonb_build_object(
    'name',sequencename,'type',data_type::text,'start',start_value,'min',min_value,'max',max_value,'increment',increment_by,'cycle',cycle,'cache',cache_size
  ) order by sequencename) from pg_sequences where schemaname='public'), '[]'::jsonb),
  'buckets', coalesce((select jsonb_agg(jsonb_build_object('id',id,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types) order by id)
    from storage.buckets where id='request-references'), '[]'::jsonb)
);
rollback;
