-- Extensions
create extension if not exists "pgcrypto";

-- Updated-at trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Role enum for organization members
create type public.member_role as enum (
  'OWNER',
  'ADMIN',
  'MANAGER',
  'CASHIER',
  'RECEPTIONIST',
  'STAFF'
);

-- Organizations (tenants / salons)
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organizations_slug_idx on public.organizations (slug);

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;

-- Organization members (user â†” tenant membership)
create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'STAFF',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organization_members_user_id_idx
  on public.organization_members (user_id);

create index organization_members_org_id_idx
  on public.organization_members (organization_id);

create trigger organization_members_set_updated_at
  before update on public.organization_members
  for each row execute function public.set_updated_at();

alter table public.organization_members enable row level security;

-- Helper: get the current user's role in an organization
create or replace function public.user_org_role(org_id uuid)
returns public.member_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.organization_members
  where user_id = auth.uid()
    and organization_id = org_id
  limit 1;
$$;

-- Helper: check if user is a member of an organization
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where user_id = auth.uid()
      and organization_id = org_id
  );
$$;

-- Organizations: members can read their own orgs
create policy "members_select_organizations"
  on public.organizations
  for select
  to authenticated
  using (public.is_org_member(id));

create policy "owners_admins_update_organizations"
  on public.organizations
  for update
  to authenticated
  using (
    public.user_org_role(id) in ('OWNER', 'ADMIN')
  )
  with check (
    public.user_org_role(id) in ('OWNER', 'ADMIN')
  );

-- Organization members: members can see co-members in their org
create policy "members_select_organization_members"
  on public.organization_members
  for select
  to authenticated
  using (public.is_org_member(organization_id));

create policy "owners_admins_insert_organization_members"
  on public.organization_members
  for insert
  to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN')
  );

create policy "owners_admins_update_organization_members"
  on public.organization_members
  for update
  to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN')
  )
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN')
  );

create policy "owners_admins_delete_organization_members"
  on public.organization_members
  for delete
  to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN')
  );

-- Bootstrap: allow authenticated users to create their first organization
create policy "authenticated_insert_organizations"
  on public.organizations
  for insert
  to authenticated
  with check (true);

-- Bootstrap: allow users to add themselves as OWNER of a new org
create policy "self_insert_owner_membership"
  on public.organization_members
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and role = 'OWNER'
    and not exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
    )
  );

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

-- Service categories
create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index service_categories_org_idx on public.service_categories (organization_id);

create trigger service_categories_set_updated_at
  before update on public.service_categories
  for each row execute function public.set_updated_at();

alter table public.service_categories enable row level security;

-- Services
create table public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  category_id uuid references public.service_categories (id) on delete set null,
  name text not null,
  description text,
  price numeric(10, 2) not null default 0 check (price >= 0),
  duration_minutes int not null default 30 check (duration_minutes > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index services_organization_id_idx on public.services (organization_id);
create index services_category_id_idx on public.services (category_id);
create index services_active_idx on public.services (organization_id, is_active);

create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

alter table public.services enable row level security;

-- All members can read categories and services
create policy "members_select_service_categories"
  on public.service_categories
  for select
  to authenticated
  using (public.is_org_member(organization_id));

create policy "members_select_services"
  on public.services
  for select
  to authenticated
  using (public.is_org_member(organization_id));

-- MANAGER+ can manage categories
create policy "managers_insert_service_categories"
  on public.service_categories
  for insert
  to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

create policy "managers_update_service_categories"
  on public.service_categories
  for update
  to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  )
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

create policy "managers_delete_service_categories"
  on public.service_categories
  for delete
  to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

-- MANAGER+ can manage services (price changes)
create policy "managers_insert_services"
  on public.services
  for insert
  to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

create policy "managers_update_services"
  on public.services
  for update
  to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  )
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

create policy "managers_delete_services"
  on public.services
  for delete
  to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

-- Packages (bundled services)
create table public.packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  description text,
  price numeric(10, 2) not null default 0 check (price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index packages_organization_id_idx on public.packages (organization_id);
create index packages_active_idx on public.packages (organization_id, is_active);

create trigger packages_set_updated_at
  before update on public.packages
  for each row execute function public.set_updated_at();

alter table public.packages enable row level security;

-- Package line items
create table public.package_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  package_id uuid not null references public.packages (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  quantity int not null default 1 check (quantity > 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index package_items_package_id_idx on public.package_items (package_id);
create index package_items_organization_id_idx on public.package_items (organization_id);

alter table public.package_items enable row level security;

-- All members can read packages and items
create policy "members_select_packages"
  on public.packages
  for select
  to authenticated
  using (public.is_org_member(organization_id));

create policy "members_select_package_items"
  on public.package_items
  for select
  to authenticated
  using (public.is_org_member(organization_id));

-- MANAGER+ can manage packages
create policy "managers_insert_packages"
  on public.packages
  for insert
  to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

create policy "managers_update_packages"
  on public.packages
  for update
  to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  )
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

create policy "managers_delete_packages"
  on public.packages
  for delete
  to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

-- MANAGER+ can manage package items
create policy "managers_insert_package_items"
  on public.package_items
  for insert
  to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

create policy "managers_update_package_items"
  on public.package_items
  for update
  to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  )
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

create policy "managers_delete_package_items"
  on public.package_items
  for delete
  to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

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

-- Inventory transactions
create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  type public.inventory_transaction_type not null,
  quantity int not null check (quantity > 0),
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index inventory_transactions_product_idx on public.inventory_transactions (product_id);
create index inventory_transactions_org_idx on public.inventory_transactions (organization_id);

alter table public.inventory_transactions enable row level security;

-- Auto-update product stock when inventory transaction is inserted
create or replace function public.apply_inventory_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 'IN' then
    update public.products
    set stock_quantity = stock_quantity + new.quantity
    where id = new.product_id;
  elsif new.type = 'OUT' then
    update public.products
    set stock_quantity = greatest(0, stock_quantity - new.quantity)
    where id = new.product_id;
  elsif new.type = 'ADJUSTMENT' then
    update public.products
    set stock_quantity = new.quantity
    where id = new.product_id;
  end if;
  return new;
end;
$$;

create trigger inventory_transactions_apply_stock
  after insert on public.inventory_transactions
  for each row execute function public.apply_inventory_transaction();

-- RLS: inventory
create policy "members_select_inventory_transactions"
  on public.inventory_transactions for select to authenticated
  using (public.is_org_member(organization_id));

-- CASHIER+ can record stock OUT (sales); MANAGER+ can do all types
create policy "cashiers_insert_inventory_out"
  on public.inventory_transactions for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'CASHIER')
    and type = 'OUT'
  );

create policy "managers_insert_inventory_in_adjust"
  on public.inventory_transactions for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
    and type in ('IN', 'ADJUSTMENT')
  );

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

-- WhatsApp message enums
create type public.whatsapp_direction as enum ('INBOUND', 'OUTBOUND');
create type public.whatsapp_status as enum ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'RECEIVED');

-- WhatsApp messages log
create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  direction public.whatsapp_direction not null,
  status public.whatsapp_status not null default 'PENDING',
  phone text not null,
  body text not null,
  external_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index whatsapp_messages_org_idx on public.whatsapp_messages (organization_id);
create index whatsapp_messages_phone_idx on public.whatsapp_messages (organization_id, phone);
create index whatsapp_messages_created_idx on public.whatsapp_messages (organization_id, created_at desc);

alter table public.whatsapp_messages enable row level security;

-- Members can read messages in their org
create policy "members_select_whatsapp_messages"
  on public.whatsapp_messages for select to authenticated
  using (public.is_org_member(organization_id));

-- RECEPTIONIST+ can send (insert outbound)
create policy "staff_insert_whatsapp_outbound"
  on public.whatsapp_messages for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST')
    and direction = 'OUTBOUND'
  );

-- Service/webhook inserts inbound via service role (bypasses RLS)

-- Audit logs for sensitive actions
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_logs_org_idx on public.audit_logs (organization_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

alter table public.audit_logs enable row level security;

-- MANAGER+ can read audit logs
create policy "managers_select_audit_logs"
  on public.audit_logs for select to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

-- Authenticated users can insert audit logs for their org (app server actions)
create policy "members_insert_audit_logs"
  on public.audit_logs for insert to authenticated
  with check (public.is_org_member(organization_id));

-- Staff profiles (salon employees, may or may not have app login)
create type public.staff_status as enum ('ACTIVE', 'INACTIVE');

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  member_id uuid references public.organization_members (id) on delete set null,
  full_name text not null,
  phone text,
  email text,
  job_title text,
  pin_code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index staff_org_idx on public.staff (organization_id);

create trigger staff_set_updated_at
  before update on public.staff
  for each row execute function public.set_updated_at();

alter table public.staff enable row level security;

create policy "members_select_staff"
  on public.staff for select to authenticated
  using (public.is_org_member(organization_id));

create policy "managers_insert_staff"
  on public.staff for insert to authenticated
  with check (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'));

create policy "managers_update_staff"
  on public.staff for update to authenticated
  using (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'))
  with check (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'));

create policy "managers_delete_staff"
  on public.staff for delete to authenticated
  using (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'));

-- Staff schedules (weekly availability)
create table public.staff_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  unique (staff_id, day_of_week)
);

alter table public.staff_schedules enable row level security;

create policy "members_select_staff_schedules"
  on public.staff_schedules for select to authenticated
  using (public.is_org_member(organization_id));

create policy "managers_manage_staff_schedules"
  on public.staff_schedules for all to authenticated
  using (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'))
  with check (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'));

-- Appointments
create type public.appointment_status as enum (
  'SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'
);
create type public.appointment_source as enum ('WALK_IN', 'PHONE', 'ONLINE', 'STAFF');

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete restrict,
  staff_id uuid references public.staff (id) on delete set null,
  scheduled_at timestamptz not null,
  duration_minutes int not null default 30 check (duration_minutes > 0),
  status public.appointment_status not null default 'SCHEDULED',
  source public.appointment_source not null default 'STAFF',
  notes text,
  manual_payment_amount numeric(10, 2) check (manual_payment_amount is null or manual_payment_amount >= 0),
  manual_payment_method public.payment_method,
  manual_payment_notes text,
  manual_payment_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appointments_org_idx on public.appointments (organization_id, scheduled_at);
create index appointments_status_idx on public.appointments (organization_id, status);

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

alter table public.appointments enable row level security;

create table public.appointment_services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  service_name text not null,
  price numeric(10, 2) not null default 0,
  duration_minutes int not null default 30,
  created_at timestamptz not null default now()
);

create index appointment_services_appt_idx on public.appointment_services (appointment_id);

alter table public.appointment_services enable row level security;

-- RLS appointments
create policy "members_select_appointments"
  on public.appointments for select to authenticated
  using (public.is_org_member(organization_id));

create policy "receptionist_insert_appointments"
  on public.appointments for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'CASHIER')
  );

create policy "receptionist_update_appointments"
  on public.appointments for update to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'CASHIER', 'STAFF')
  )
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'CASHIER', 'STAFF')
  );

create policy "managers_delete_appointments"
  on public.appointments for delete to authenticated
  using (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'));

create policy "members_select_appointment_services"
  on public.appointment_services for select to authenticated
  using (public.is_org_member(organization_id));

create policy "receptionist_insert_appointment_services"
  on public.appointment_services for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'CASHIER')
  );

-- Public online booking: allow anon insert when org slug matches (via service role in API)

-- Queue tokens (generated when customer arrives)
create type public.queue_token_status as enum ('WAITING', 'CALLED', 'SERVING', 'COMPLETED', 'CANCELLED');

create table public.queue_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  token_number int not null,
  token_date date not null default current_date,
  customer_id uuid references public.customers (id) on delete set null,
  appointment_id uuid references public.appointments (id) on delete set null,
  customer_name text not null,
  status public.queue_token_status not null default 'WAITING',
  device_id uuid,
  called_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, token_date, token_number)
);

create index queue_tokens_org_date_idx on public.queue_tokens (organization_id, token_date, status);

alter table public.queue_tokens enable row level security;

create policy "members_select_queue_tokens"
  on public.queue_tokens for select to authenticated
  using (public.is_org_member(organization_id));

create policy "staff_insert_queue_tokens"
  on public.queue_tokens for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'CASHIER', 'STAFF')
  );

create policy "staff_update_queue_tokens"
  on public.queue_tokens for update to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST', 'CASHIER', 'STAFF')
  );

-- Next token number helper
create or replace function public.next_queue_token_number(org_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(max(token_number), 0) + 1
  from public.queue_tokens
  where organization_id = org_id
    and token_date = current_date;
$$;

-- Staff attendance
create type public.attendance_method as enum ('MANUAL', 'DEVICE', 'APP');

create table public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  device_id uuid,
  check_in_at timestamptz not null default now(),
  check_out_at timestamptz,
  method public.attendance_method not null default 'MANUAL',
  notes text,
  created_at timestamptz not null default now()
);

create index staff_attendance_staff_idx on public.staff_attendance (staff_id, check_in_at desc);
create index staff_attendance_org_idx on public.staff_attendance (organization_id, check_in_at desc);

alter table public.staff_attendance enable row level security;

create policy "members_select_staff_attendance"
  on public.staff_attendance for select to authenticated
  using (public.is_org_member(organization_id));

create policy "managers_insert_staff_attendance"
  on public.staff_attendance for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
    or public.user_org_role(organization_id) in ('RECEPTIONIST', 'CASHIER', 'STAFF')
  );

create policy "managers_update_staff_attendance"
  on public.staff_attendance for update to authenticated
  using (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'RECEPTIONIST'));

-- Devices (attendance terminal, cash drawer, receipt printer)
create type public.device_type as enum ('ATTENDANCE', 'DRAWER', 'PRINTER', 'TOKEN_KIOSK');
create type public.device_command_type as enum ('OPEN_DRAWER', 'CLOSE_DRAWER', 'PRINT_RECEIPT', 'PRINT_TOKEN');
create type public.device_command_status as enum ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  type public.device_type not null,
  api_key text not null unique default encode(gen_random_bytes(32), 'hex'),
  location text,
  is_active boolean not null default true,
  auto_registered boolean not null default false,
  last_seen_at timestamptz,
  config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index devices_org_idx on public.devices (organization_id);
create index devices_api_key_idx on public.devices (api_key);

create trigger devices_set_updated_at
  before update on public.devices
  for each row execute function public.set_updated_at();

alter table public.devices enable row level security;

create table public.device_commands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  device_id uuid not null references public.devices (id) on delete cascade,
  command public.device_command_type not null,
  payload jsonb not null default '{}',
  status public.device_command_status not null default 'PENDING',
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index device_commands_device_pending_idx
  on public.device_commands (device_id, status)
  where status = 'PENDING';

alter table public.device_commands enable row level security;

-- FK for device_id on queue_tokens and staff_attendance
alter table public.queue_tokens
  add constraint queue_tokens_device_id_fkey
  foreign key (device_id) references public.devices (id) on delete set null;

alter table public.staff_attendance
  add constraint staff_attendance_device_id_fkey
  foreign key (device_id) references public.devices (id) on delete set null;

-- RLS devices
create policy "managers_select_devices"
  on public.devices for select to authenticated
  using (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'));

create policy "managers_insert_devices"
  on public.devices for insert to authenticated
  with check (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'));

create policy "managers_update_devices"
  on public.devices for update to authenticated
  using (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'));

create policy "managers_delete_devices"
  on public.devices for delete to authenticated
  using (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER'));

create policy "managers_select_device_commands"
  on public.device_commands for select to authenticated
  using (public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'CASHIER'));

create policy "staff_insert_device_commands"
  on public.device_commands for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'RECEPTIONIST')
  );

create policy "staff_update_device_commands"
  on public.device_commands for update to authenticated
  using (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'RECEPTIONIST')
  );

-- Per-role navigation permissions (JSON overrides on top of app defaults)
alter table public.organizations
  add column if not exists nav_permissions jsonb not null default '{}'::jsonb;

-- Financial flow: appointment deposits, sales link, expenses
create table if not exists public.appointment_deposits (
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

create index if not exists appointment_deposits_appointment_idx on public.appointment_deposits (appointment_id);
create index if not exists appointment_deposits_org_idx on public.appointment_deposits (organization_id);

alter table public.appointment_deposits enable row level security;

alter table public.sales
  add column if not exists appointment_id uuid references public.appointments (id) on delete set null,
  add column if not exists deposit_applied numeric(10, 2) not null default 0 check (deposit_applied >= 0);

do $$ begin
  create type public.expense_category as enum (
    'RENT', 'UTILITIES', 'SUPPLIES', 'PAYROLL', 'MARKETING', 'MAINTENANCE', 'OTHER'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.expenses (
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

create index if not exists expenses_org_date_idx on public.expenses (organization_id, expense_date desc);
alter table public.expenses enable row level security;

