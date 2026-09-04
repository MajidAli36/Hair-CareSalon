-- Human-readable booking reference for online / reception appointments

alter table public.appointments
  add column if not exists booking_number text;

comment on column public.appointments.booking_number is
  'Human-readable booking reference shown on customer slips and admin payment review.';

create unique index if not exists appointments_org_booking_number_uidx
  on public.appointments (organization_id, booking_number)
  where booking_number is not null;

-- Sequential BK-00001 style numbers per organization
create or replace function public.next_booking_number(org_id uuid)
returns text
language plpgsql
as $$
declare
  seq int;
begin
  select coalesce(
    max(
      case
        when booking_number ~ '^BK-[0-9]+$'
          then nullif(regexp_replace(booking_number, '^BK-', ''), '')::int
        else null
      end
    ),
    0
  ) + 1
  into seq
  from public.appointments
  where organization_id = org_id;

  return 'BK-' || lpad(seq::text, 5, '0');
end;
$$;

-- Backfill existing rows so admin can still match older bookings
update public.appointments
set booking_number = 'BK-' || upper(substr(replace(id::text, '-', ''), 1, 8))
where booking_number is null;
