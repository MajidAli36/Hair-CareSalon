-- Invoices
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sale_id uuid not null references public.sales (id) on delete cascade,
  invoice_number text not null,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, invoice_number)
);

create index invoices_sale_id_idx on public.invoices (sale_id);

alter table public.invoices enable row level security;

-- Payments
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sale_id uuid not null references public.sales (id) on delete cascade,
  amount numeric(10, 2) not null check (amount >= 0),
  method public.payment_method not null default 'CASH',
  reference text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index payments_sale_id_idx on public.payments (sale_id);
create index payments_org_idx on public.payments (organization_id);

alter table public.payments enable row level security;

-- RLS: invoices
create policy "members_select_invoices"
  on public.invoices for select to authenticated
  using (public.is_org_member(organization_id));

create policy "cashiers_insert_invoices"
  on public.invoices for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'CASHIER')
  );

-- RLS: payments
create policy "members_select_payments"
  on public.payments for select to authenticated
  using (public.is_org_member(organization_id));

create policy "cashiers_insert_payments"
  on public.payments for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'CASHIER')
  );
