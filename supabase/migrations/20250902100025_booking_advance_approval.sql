-- Online booking advance settings + deposit approval workflow
alter table public.organizations
  add column if not exists booking_advance_amount numeric(10, 2) not null default 0 check (booking_advance_amount >= 0),
  add column if not exists booking_advance_percent int not null default 0 check (booking_advance_percent between 0 and 100),
  add column if not exists booking_payment_instructions text;

create type public.deposit_status as enum ('PENDING', 'APPROVED', 'REJECTED');

alter table public.appointment_deposits
  add column if not exists status public.deposit_status not null default 'APPROVED',
  add column if not exists payment_reference text,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users (id) on delete set null;

-- Existing deposits were collected in person — already approved
update public.appointment_deposits set status = 'APPROVED' where status is null;

create index if not exists appointment_deposits_pending_idx
  on public.appointment_deposits (organization_id, status)
  where status = 'PENDING';
