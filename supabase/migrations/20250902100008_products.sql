-- Product enums
create type public.inventory_transaction_type as enum ('IN', 'OUT', 'ADJUSTMENT');
create type public.sale_status as enum ('DRAFT', 'COMPLETED', 'VOID');
create type public.sale_item_type as enum ('SERVICE', 'PRODUCT', 'PACKAGE');
create type public.payment_method as enum ('CASH', 'CARD', 'OTHER');

-- Product categories
create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index product_categories_org_idx on public.product_categories (organization_id);

create trigger product_categories_set_updated_at
  before update on public.product_categories
  for each row execute function public.set_updated_at();

alter table public.product_categories enable row level security;

-- Products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  category_id uuid references public.product_categories (id) on delete set null,
  sku text,
  name text not null,
  description text,
  cost_price numeric(10, 2) not null default 0 check (cost_price >= 0),
  retail_price numeric(10, 2) not null default 0 check (retail_price >= 0),
  stock_quantity int not null default 0 check (stock_quantity >= 0),
  low_stock_threshold int not null default 5 check (low_stock_threshold >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_organization_id_idx on public.products (organization_id);
create index products_sku_idx on public.products (organization_id, sku);
create index products_stock_idx on public.products (organization_id, stock_quantity);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;

-- RLS: product categories
create policy "members_select_product_categories"
  on public.product_categories for select to authenticated
  using (public.is_org_member(organization_id));

create policy "managers_insert_product_categories"
  on public.product_categories for insert to authenticated
  with check (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'));

create policy "managers_update_product_categories"
  on public.product_categories for update to authenticated
  using (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'))
  with check (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'));

create policy "managers_delete_product_categories"
  on public.product_categories for delete to authenticated
  using (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'));

-- RLS: products
create policy "members_select_products"
  on public.products for select to authenticated
  using (public.is_org_member(organization_id));

create policy "managers_insert_products"
  on public.products for insert to authenticated
  with check (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'));

create policy "managers_update_products"
  on public.products for update to authenticated
  using (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'))
  with check (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'));

create policy "managers_delete_products"
  on public.products for delete to authenticated
  using (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'));
