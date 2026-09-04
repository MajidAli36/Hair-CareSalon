-- Invoice lifecycle: amendment versioning, refunds, extended sale status

-- Extend sale_status enum
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'sale_status' and e.enumlabel = 'AMENDED'
  ) then
    alter type public.sale_status add value 'AMENDED';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'sale_status' and e.enumlabel = 'REFUNDED'
  ) then
    alter type public.sale_status add value 'REFUNDED';
  end if;
end $$;

-- Sale header lifecycle columns
alter table public.sales
  add column if not exists current_version integer not null default 1,
  add column if not exists void_reason text,
  add column if not exists voided_by uuid references auth.users (id),
  add column if not exists last_amended_at timestamptz,
  add column if not exists last_amended_by uuid references auth.users (id);

comment on column public.sales.current_version is 'Monotonic invoice revision; historical snapshots in sale_versions';

-- Immutable version history (never delete rows in app logic)
create table if not exists public.sale_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sale_id uuid not null references public.sales (id) on delete cascade,
  version_number integer not null,
  customer_id uuid references public.customers (id) on delete set null,
  appointment_id uuid references public.appointments (id) on delete set null,
  subtotal numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  tax numeric(12, 2) not null default 0,
  deposit_applied numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  payment_total numeric(12, 2) not null default 0,
  status text not null,
  notes text,
  change_reason text,
  changed_by uuid references auth.users (id),
  changed_at timestamptz not null default now(),
  unique (sale_id, version_number)
);

create index if not exists sale_versions_sale_idx on public.sale_versions (sale_id);
create index if not exists sale_versions_org_idx on public.sale_versions (organization_id);

create table if not exists public.sale_version_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sale_version_id uuid not null references public.sale_versions (id) on delete cascade,
  item_type public.sale_item_type not null,
  item_id uuid not null,
  name text not null,
  quantity numeric(12, 2) not null check (quantity > 0),
  unit_price numeric(12, 2) not null,
  line_total numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

create index if not exists sale_version_items_version_idx on public.sale_version_items (sale_version_id);

-- Sale-level refunds (full or partial); does not delete original sale
create table if not exists public.sale_refunds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sale_id uuid not null references public.sales (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  method public.payment_method not null default 'CASH',
  reason text not null,
  reference text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists sale_refunds_sale_idx on public.sale_refunds (sale_id);
create index if not exists sale_refunds_org_idx on public.sale_refunds (organization_id);

alter table public.sale_versions enable row level security;
alter table public.sale_version_items enable row level security;
alter table public.sale_refunds enable row level security;

drop policy if exists "members_select_sale_versions" on public.sale_versions;
drop policy if exists "managers_insert_sale_versions" on public.sale_versions;
drop policy if exists "members_select_sale_version_items" on public.sale_version_items;
drop policy if exists "managers_insert_sale_version_items" on public.sale_version_items;
drop policy if exists "members_select_sale_refunds" on public.sale_refunds;
drop policy if exists "managers_insert_sale_refunds" on public.sale_refunds;

create policy "members_select_sale_versions"
  on public.sale_versions for select to authenticated
  using (public.is_org_member(organization_id));

create policy "managers_insert_sale_versions"
  on public.sale_versions for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

create policy "members_select_sale_version_items"
  on public.sale_version_items for select to authenticated
  using (public.is_org_member(organization_id));

create policy "managers_insert_sale_version_items"
  on public.sale_version_items for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );

create policy "members_select_sale_refunds"
  on public.sale_refunds for select to authenticated
  using (public.is_org_member(organization_id));

create policy "managers_insert_sale_refunds"
  on public.sale_refunds for insert to authenticated
  with check (
    public.user_org_role(organization_id) in ('OWNER', 'ADMIN', 'MANAGER')
  );