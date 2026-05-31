-- Customer phone normalization for safer customer matching.
--
-- Run in Supabase SQL Editor before relying on phone-based customer matching.
-- The original phone value stays in public.customers.phone for display.
-- public.customers.phone_normalized is used only for matching/search.

alter table public.customers
add column if not exists phone_normalized text;

create or replace function public.normalize_customer_phone(phone_value text)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  digits := regexp_replace(coalesce(phone_value, ''), '[^0-9]', '', 'g');

  if digits = '' then
    return null;
  end if;

  if length(digits) = 10 then
    return '1' || digits;
  end if;

  if length(digits) = 11 and left(digits, 1) = '1' then
    return digits;
  end if;

  return digits;
end;
$$;

create or replace function public.set_customer_phone_normalized()
returns trigger
language plpgsql
as $$
begin
  new.phone_normalized := public.normalize_customer_phone(new.phone);
  return new;
end;
$$;

drop trigger if exists set_customer_phone_normalized on public.customers;
create trigger set_customer_phone_normalized
before insert or update of phone on public.customers
for each row
execute function public.set_customer_phone_normalized();

update public.customers
set phone_normalized = public.normalize_customer_phone(phone)
where phone is not null;

create index if not exists idx_customers_phone_normalized
on public.customers(phone_normalized)
where phone_normalized is not null;
