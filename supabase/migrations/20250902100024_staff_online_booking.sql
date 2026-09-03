alter table public.staff
  add column if not exists online_booking_enabled boolean not null default false;
