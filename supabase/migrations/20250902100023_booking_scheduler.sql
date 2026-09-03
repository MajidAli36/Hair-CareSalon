-- Online booking scheduler settings on organization
alter table public.organizations
  add column if not exists booking_slot_minutes int not null default 30 check (booking_slot_minutes between 15 and 120),
  add column if not exists booking_days_ahead int not null default 30 check (booking_days_ahead between 1 and 90);
