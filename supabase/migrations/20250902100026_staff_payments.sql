-- Staff salary & payment records (full, partial, advance, bonus)
create type public.staff_payment_type as enum ('SALARY', 'PARTIAL', 'ADVANCE', 'BONUS');

create table public.staff_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete restrict,
  amount numeric(10, 2) not null check (amount > 0),
  payment_type public.staff_payment_type not null default 'SALARY',
  payment_method public.payment_method not null default 'CASH',
  payment_date date not null default current_date,
  paid_at timestamptz not null default now(),
  period_start date,
  period_end date,
  amount_due numeric(10, 2) check (amount_due is null or amount_due >= 0),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index staff_payments_org_date_idx on public.staff_payments (organization_id, payment_date desc);
create index staff_payments_staff_idx on public.staff_payments (staff_id, payment_date desc);

alter table public.staff_payments enable row level security;

create policy "members_select_staff_payments"
  on public.staff_payments for select to authenticated
  using (public.is_org_member(organization_id));

create policy "managers_insert_staff_payments"
  on public.staff_payments for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

create policy "managers_delete_staff_payments"
  on public.staff_payments for delete to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

-- Link expenses to staff when recording payroll via expense form (optional)
alter table public.expenses
  add column if not exists staff_id uuid references public.staff (id) on delete set null;
