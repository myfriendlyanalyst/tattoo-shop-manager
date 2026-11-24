-- FND-03: append-only audit history and database-enforced financial locks.

create table public.financial_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  entity_type text not null,
  entity_id uuid not null,
  before_value jsonb,
  after_value jsonb,
  reason text not null,
  occurred_at timestamptz not null default now(),
  check (
    (action = 'insert' and before_value is null and after_value is not null)
    or (action = 'update' and before_value is not null and after_value is not null)
    or (action = 'delete' and before_value is not null and after_value is null)
  )
);

comment on table public.financial_audit_events is
  'Append-only history for financial records. Written only by audit triggers.';
comment on column public.financial_audit_events.reason is
  'Caller-provided app.audit_reason when available, otherwise a stable operation reason.';

create index financial_audit_events_entity_idx
on public.financial_audit_events (entity_type, entity_id, occurred_at desc);

create index financial_audit_events_actor_idx
on public.financial_audit_events (actor_id, occurred_at desc);

alter table public.financial_audit_events enable row level security;

grant select on public.financial_audit_events to authenticated;
revoke insert, update, delete on public.financial_audit_events from authenticated, anon;

create or replace function public.financial_audit_reason(fallback_reason text)
returns text
language sql
stable
set search_path = public, pg_catalog
as $$
  select coalesce(
    nullif(btrim(current_setting('app.audit_reason', true)), ''),
    fallback_reason
  );
$$;

create or replace function public.record_financial_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  row_id uuid;
  event_reason text;
begin
  row_id := case when tg_op = 'DELETE' then old.id else new.id end;
  event_reason := public.financial_audit_reason(
    case tg_op
      when 'INSERT' then 'record_created'
      when 'UPDATE' then 'record_updated'
      else 'record_deleted'
    end
  );

  insert into public.financial_audit_events (
    actor_id,
    action,
    entity_type,
    entity_id,
    before_value,
    after_value,
    reason
  ) values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    row_id,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    event_reason
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create or replace function public.financial_record_is_locked(
  checked_entity_type text,
  checked_entity_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  case checked_entity_type
    when 'payouts' then
      return exists (
        select 1 from public.payouts p
        where p.id = checked_entity_id and p.status in ('ready', 'paid')
      );
    when 'payout_items' then
      return exists (
        select 1
        from public.payout_items pi
        join public.payouts p on p.id = pi.payout_id
        where pi.id = checked_entity_id and p.status in ('ready', 'paid')
      );
    when 'session_entries' then
      return exists (
        select 1
        from public.payout_items pi
        join public.payouts p on p.id = pi.payout_id
        where pi.session_entry_id = checked_entity_id and p.status in ('ready', 'paid')
      );
    when 'session_payments' then
      return exists (
        select 1
        from public.session_payments sp
        join public.payout_items pi on pi.session_entry_id = sp.session_entry_id
        join public.payouts p on p.id = pi.payout_id
        where sp.id = checked_entity_id and p.status in ('ready', 'paid')
      );
    when 'deposits' then
      return exists (
        select 1
        from public.payout_items pi
        join public.payouts p on p.id = pi.payout_id
        where pi.deposit_id = checked_entity_id and p.status in ('ready', 'paid')
      );
    when 'deposit_applications' then
      return exists (
        select 1
        from public.deposit_applications da
        join public.payout_items pi
          on pi.session_entry_id = da.session_entry_id or pi.deposit_id = da.deposit_id
        join public.payouts p on p.id = pi.payout_id
        where da.id = checked_entity_id and p.status in ('ready', 'paid')
      );
    else
      return false;
  end case;
end;
$$;

create or replace function public.prevent_locked_financial_change()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    if tg_table_name = 'payouts' then
      if new.status in ('ready', 'paid') then
        raise exception 'A settlement must be created as draft before it can be locked.' using errcode = '55000';
      end if;
    elsif tg_table_name = 'payout_items' then
      if exists (select 1 from public.payouts where id = new.payout_id and status in ('ready', 'paid')) then
        raise exception 'This settlement is locked. Create a correction instead.' using errcode = '55000';
      end if;
    elsif tg_table_name = 'session_payments' then
      if public.financial_record_is_locked('session_entries', new.session_entry_id) then
        raise exception 'This session is locked by a settlement. Create a correction instead.' using errcode = '55000';
      end if;
    elsif tg_table_name = 'deposit_applications' then
      if public.financial_record_is_locked('session_entries', new.session_entry_id)
        or public.financial_record_is_locked('deposits', new.deposit_id) then
        raise exception 'This deposit application is locked by a settlement. Create a correction instead.' using errcode = '55000';
      end if;
    end if;
    return new;
  end if;

  if public.financial_record_is_locked(tg_table_name, old.id) then
    -- The existing payout flow still needs the explicit ready -> paid transition.
    if tg_table_name = 'payouts' and tg_op = 'UPDATE' then
      if old.status = 'ready'
        and new.status = 'paid'
        and (to_jsonb(new) - array['status', 'paid_at', 'paid_by', 'updated_at'])
          = (to_jsonb(old) - array['status', 'paid_at', 'paid_by', 'updated_at']) then
        return new;
      end if;
    end if;

    raise exception 'This financial record is locked by a ready or paid settlement. Create a correction instead.'
      using errcode = '55000';
  end if;

  if tg_op = 'UPDATE' then
    if tg_table_name = 'payout_items' then
      if exists (select 1 from public.payouts where id = new.payout_id and status in ('ready', 'paid')) then
        raise exception 'The destination settlement is locked. Create a correction instead.' using errcode = '55000';
      end if;
    elsif tg_table_name = 'session_payments' then
      if public.financial_record_is_locked('session_entries', new.session_entry_id) then
        raise exception 'The destination session is locked. Create a correction instead.' using errcode = '55000';
      end if;
    elsif tg_table_name = 'deposit_applications' then
      if public.financial_record_is_locked('session_entries', new.session_entry_id)
        or public.financial_record_is_locked('deposits', new.deposit_id) then
        raise exception 'The destination deposit application is locked. Create a correction instead.' using errcode = '55000';
      end if;
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.can_view_financial_audit_event(
  checked_entity_type text,
  checked_entity_id uuid,
  checked_actor_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  staff_id uuid := public.current_staff_id();
begin
  if public.can_access_accounting() or checked_actor_id = auth.uid() then
    return true;
  end if;

  case checked_entity_type
    when 'session_entries' then
      return exists (select 1 from public.session_entries where id = checked_entity_id and artist_id = staff_id);
    when 'session_payments' then
      return exists (
        select 1 from public.session_payments sp
        join public.session_entries se on se.id = sp.session_entry_id
        where sp.id = checked_entity_id and se.artist_id = staff_id
      );
    when 'deposits' then
      return exists (select 1 from public.deposits where id = checked_entity_id and artist_id = staff_id);
    when 'deposit_applications' then
      return exists (
        select 1 from public.deposit_applications da
        join public.deposits d on d.id = da.deposit_id
        where da.id = checked_entity_id and d.artist_id = staff_id
      );
    when 'payouts' then
      return exists (select 1 from public.payouts where id = checked_entity_id and artist_id = staff_id);
    when 'payout_items' then
      return exists (
        select 1 from public.payout_items pi
        join public.payouts p on p.id = pi.payout_id
        where pi.id = checked_entity_id and p.artist_id = staff_id
      );
    else
      return false;
  end case;
end;
$$;

create policy financial_audit_events_select_visible
on public.financial_audit_events
for select
using (public.can_view_financial_audit_event(entity_type, entity_id, actor_id));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'session_entries',
    'session_payments',
    'deposits',
    'deposit_applications',
    'payouts',
    'payout_items'
  ] loop
    execute format(
      'create trigger %I before insert or update or delete on public.%I for each row execute function public.prevent_locked_financial_change()',
      table_name || '_prevent_locked_change',
      table_name
    );
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.record_financial_audit_event()',
      table_name || '_record_audit_event',
      table_name
    );
  end loop;
end;
$$;

-- End FND-03.

