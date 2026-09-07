-- Service consumables (salon / backbar products used when a service is sold)
-- Does not change retail PRODUCT sales; optional recipe per service.

create table if not exists public.service_consumables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity int not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, product_id)
);

create index if not exists service_consumables_org_idx
  on public.service_consumables (organization_id);
create index if not exists service_consumables_service_idx
  on public.service_consumables (service_id);
create index if not exists service_consumables_product_idx
  on public.service_consumables (product_id);

create trigger service_consumables_set_updated_at
  before update on public.service_consumables
  for each row execute function public.set_updated_at();

alter table public.service_consumables enable row level security;

create policy "members_select_service_consumables"
  on public.service_consumables for select to authenticated
  using (public.is_org_member(organization_id));

create policy "managers_insert_service_consumables"
  on public.service_consumables for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

create policy "managers_update_service_consumables"
  on public.service_consumables for update to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  )
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

create policy "managers_delete_service_consumables"
  on public.service_consumables for delete to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

-- Snapshot of stock used on a sale (for void / amend / refund restore)
create table if not exists public.sale_consumable_usages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sale_id uuid not null references public.sales (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity int not null check (quantity > 0),
  unit_cost numeric(10, 2) not null default 0 check (unit_cost >= 0),
  created_at timestamptz not null default now()
);

create index if not exists sale_consumable_usages_sale_idx
  on public.sale_consumable_usages (sale_id);
create index if not exists sale_consumable_usages_org_idx
  on public.sale_consumable_usages (organization_id);

alter table public.sale_consumable_usages enable row level security;

create policy "members_select_sale_consumable_usages"
  on public.sale_consumable_usages for select to authenticated
  using (public.is_org_member(organization_id));

-- Cashiers create usages on checkout; managers on amend
create policy "cashiers_insert_sale_consumable_usages"
  on public.sale_consumable_usages for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'CASHIER')
  );

create policy "managers_delete_sale_consumable_usages"
  on public.sale_consumable_usages for delete to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'CASHIER')
  );
