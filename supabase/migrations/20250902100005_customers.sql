-- Customers
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  first_name text not null,
  last_name text,
  phone text,
  email text,
  notes text,
  tags text[] not null default '{}',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_organization_id_idx on public.customers (organization_id);
create index customers_deleted_at_idx on public.customers (deleted_at);
create index customers_name_idx on public.customers (organization_id, first_name, last_name);
create index customers_phone_idx on public.customers (organization_id, phone);

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

alter table public.customers enable row level security;

-- RECEPTIONIST+ can read active customers in their org
create policy "members_select_customers"
  on public.customers
  for select
  to authenticated
  using (
    public.is_org_member(organization_id)
    and public.user_org_role(organization_id) in (
      'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'RECEPTIONIST', 'STAFF'
    )
  );

-- MANAGER+ can insert customers (org_id must match membership)
create policy "managers_insert_customers"
  on public.customers
  for insert
  to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

-- MANAGER+ can update customers in their org
create policy "managers_update_customers"
  on public.customers
  for update
  to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  )
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

-- MANAGER+ can soft-delete via update (deleted_at); hard delete also allowed
create policy "managers_delete_customers"
  on public.customers
  for delete
  to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );
