-- Sales
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  status public.sale_status not null default 'DRAFT',
  subtotal numeric(10, 2) not null default 0 check (subtotal >= 0),
  discount numeric(10, 2) not null default 0 check (discount >= 0),
  total numeric(10, 2) not null default 0 check (total >= 0),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  completed_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sales_organization_id_idx on public.sales (organization_id);
create index sales_status_idx on public.sales (organization_id, status);
create index sales_completed_at_idx on public.sales (organization_id, completed_at);

create trigger sales_set_updated_at
  before update on public.sales
  for each row execute function public.set_updated_at();

alter table public.sales enable row level security;

-- Sale line items
create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sale_id uuid not null references public.sales (id) on delete cascade,
  item_type public.sale_item_type not null,
  item_id uuid not null,
  name text not null,
  quantity int not null default 1 check (quantity > 0),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  line_total numeric(10, 2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create index sale_items_sale_id_idx on public.sale_items (sale_id);
create index sale_items_org_idx on public.sale_items (organization_id);

alter table public.sale_items enable row level security;

-- RLS: sales
create policy "members_select_sales"
  on public.sales for select to authenticated
  using (public.is_org_member(organization_id));

create policy "cashiers_insert_sales"
  on public.sales for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'CASHIER')
  );

create policy "cashiers_update_sales"
  on public.sales for update to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'CASHIER')
  )
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'CASHIER')
  );

create policy "managers_void_sales"
  on public.sales for delete to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

-- RLS: sale items
create policy "members_select_sale_items"
  on public.sale_items for select to authenticated
  using (public.is_org_member(organization_id));

create policy "cashiers_insert_sale_items"
  on public.sale_items for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'CASHIER')
  );

create policy "cashiers_update_sale_items"
  on public.sale_items for update to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'CASHIER')
  );

create policy "cashiers_delete_sale_items"
  on public.sale_items for delete to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'CASHIER')
  );
