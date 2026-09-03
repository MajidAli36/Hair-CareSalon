-- Advance refund / revert support
alter type public.deposit_status add value if not exists 'REFUNDED';

alter table public.appointment_deposits
  add column if not exists refund_reason text,
  add column if not exists refund_method public.payment_method,
  add column if not exists refund_reference text,
  add column if not exists refunded_at timestamptz,
  add column if not exists refunded_by uuid references auth.users (id) on delete set null;

create index if not exists appointment_deposits_refunded_idx
  on public.appointment_deposits (organization_id, status)
  where status = 'REFUNDED';
