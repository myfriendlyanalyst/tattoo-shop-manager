-- ============================================================
-- Payout Overlap Guard
-- Prevents overlapping non-void payout periods for the same artist.
-- Run in the Supabase SQL editor.
-- ============================================================

create or replace function public.prevent_overlapping_active_payouts()
returns trigger
language plpgsql
as $$
begin
  if new.status <> 'void' and exists (
    select 1
    from public.payouts existing
    where existing.artist_id = new.artist_id
      and existing.id <> new.id
      and existing.status <> 'void'
      and existing.period_start <= new.period_end
      and existing.period_end >= new.period_start
  ) then
    raise exception 'Overlapping payout period exists for this artist.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists payouts_prevent_overlap on public.payouts;

create trigger payouts_prevent_overlap
before insert or update of artist_id, period_start, period_end, status
on public.payouts
for each row
execute function public.prevent_overlapping_active_payouts();
