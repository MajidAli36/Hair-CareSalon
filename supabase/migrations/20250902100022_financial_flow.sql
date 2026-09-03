-- Appointment advance deposits (taken at booking or later)
create table public.appointment_deposits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  method public.payment_method not null default 'CASH',
  notes text,
  applied_to_sale_id uuid references public.sales (id) on delete set null,
  paid_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index appointment_deposits_appointment_idx on public.appointment_deposits (appointment_id);
create index appointment_deposits_org_idx on public.appointment_deposits (organization_id);
create index appointment_deposits_unapplied_idx on public.appointment_deposits (appointment_id)
  where applied_to_sale_id is null;

alter table public.appointment_deposits enable row level security;

create policy "members_select_appointment_deposits"
  on public.appointment_deposits for select to authenticated
  using (public.is_org_member(organization_id));

create policy "staff_insert_appointment_deposits"
  on public.appointment_deposits for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'RECEPTIONIST')
  );

create policy "staff_update_appointment_deposits"
  on public.appointment_deposits for update to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'CASHIER')
  );

-- Link sales to appointments and track deposit credit applied at POS
alter table public.sales
  add column if not exists appointment_id uuid references public.appointments (id) on delete set null,
  add column if not exists deposit_applied numeric(10, 2) not null default 0 check (deposit_applied >= 0);

create index sales_appointment_idx on public.sales (appointment_id) where appointment_id is not null;

-- Operating expenses
create type public.expense_category as enum (
  'RENT',
  'UTILITIES',
  'SUPPLIES',
  'PAYROLL',
  'MARKETING',
  'MAINTENANCE',
  'OTHER'
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  category public.expense_category not null default 'OTHER',
  amount numeric(10, 2) not null check (amount > 0),
  description text,
  expense_date date not null default current_date,
  payment_method public.payment_method not null default 'CASH',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_org_date_idx on public.expenses (organization_id, expense_date desc);

alter table public.expenses enable row level security;

create policy "members_select_expenses"
  on public.expenses for select to authenticated
  using (public.is_org_member(organization_id));

create policy "managers_insert_expenses"
  on public.expenses for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

create policy "managers_update_expenses"
  on public.expenses for update to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

create policy "managers_delete_expenses"
  on public.expenses for delete to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );
